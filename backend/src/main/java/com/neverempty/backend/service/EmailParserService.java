package com.neverempty.backend.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.ModifyMessageRequest;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.neverempty.backend.config.AppProperties;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gmail API integration for receiving forwarded purchase emails.
 * Adapts the algorithm from TestInvoiceParser/gmail_service.py:
 * - Service account with domain-wide delegation
 * - Recursive MIME body extraction
 * - base64 URL-safe decoding
 * - Send email via Gmail API
 */
@Slf4j
@Service
public class EmailParserService {

    private final AppProperties properties;
    private final LlmService llmService;
    private Gmail gmail;

    public record EmailMessage(
            String id,
            String threadId,
            String subject,
            String from,
            String date,
            String messageIdHeader,
            String bodyText,
            String bodyHtml
    ) {}

    public EmailParserService(AppProperties properties, LlmService llmService) {
        this.properties = properties;
        this.llmService = llmService;
    }

    @PostConstruct
    public void init() {
        var credentialsPath = properties.google().credentialsPath();
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("Google credentials path not configured, EmailParserService disabled");
            return;
        }

        try {
            var scopes = List.of(GmailScopes.GMAIL_MODIFY, GmailScopes.GMAIL_SEND);
            var credentials = ServiceAccountCredentials.fromStream(new FileInputStream(credentialsPath))
                    .createScoped(scopes)
                    .createDelegated(properties.google().gmailImpersonateEmail());

            var httpTransport = GoogleNetHttpTransport.newTrustedTransport();
            this.gmail = new Gmail.Builder(httpTransport, GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credentials))
                    .setApplicationName("NeverEmpty")
                    .build();
        } catch (Exception e) {
            log.error("Failed to initialize Gmail service", e);
        }
    }

    /**
     * Fetch unread emails with full body content.
     * Same algorithm as gmail_service.py get_unread_messages().
     */
    public List<EmailMessage> getUnreadEmails(int maxResults) {
        if (gmail == null) return List.of();

        try {
            var response = gmail.users().messages().list("me")
                    .setQ("is:unread")
                    .setMaxResults((long) maxResults)
                    .execute();

            var messages = response.getMessages();
            if (messages == null) return List.of();

            return messages.stream()
                    .map(msg -> getMessageDetail(msg.getId()))
                    .toList();
        } catch (Exception e) {
            log.error("Failed to fetch unread emails", e);
            return List.of();
        }
    }

    /**
     * Get full message content.
     * Same algorithm as gmail_service.py get_message_detail().
     */
    public EmailMessage getMessageDetail(String messageId) {
        try {
            var msg = gmail.users().messages().get("me", messageId)
                    .setFormat("full")
                    .execute();

            var body = new HashMap<String, String>();
            body.put("text", null);
            body.put("html", null);

            var payload = msg.getPayload();
            extractBody(payload, body);

            var headers = new HashMap<String, String>();
            if (payload.getHeaders() != null) {
                payload.getHeaders().forEach(h -> headers.put(h.getName(), h.getValue()));
            }

            return new EmailMessage(
                    msg.getId(),
                    msg.getThreadId(),
                    getHeader(headers, "Subject"),
                    getHeader(headers, "From"),
                    getHeader(headers, "Date"),
                    getHeader(headers, "Message-ID"),
                    body.get("text"),
                    body.get("html")
            );
        } catch (Exception e) {
            log.error("Failed to get message detail for {}", messageId, e);
            return null;
        }
    }

    /**
     * Parse email body into product list using LLM.
     */
    public List<LlmService.ParsedProduct> parseEmailToProducts(EmailMessage email) {
        var content = email.bodyText() != null ? email.bodyText() : email.bodyHtml();
        if (content == null || content.isBlank()) {
            return List.of();
        }
        return llmService.parseEmail(content);
    }

    /**
     * Send a plain-text email.
     * Same algorithm as gmail_service.py send_message().
     */
    public void sendEmail(String to, String subject, String body) {
        if (gmail == null) {
            log.warn("Gmail not initialized, cannot send email");
            return;
        }

        try {
            var email = "To: " + to + "\r\n" +
                    "From: " + properties.google().gmailImpersonateEmail() + "\r\n" +
                    "Subject: " + subject + "\r\n" +
                    "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
                    body;

            var raw = Base64.getUrlEncoder().encodeToString(email.getBytes(StandardCharsets.UTF_8));
            var message = new Message().setRaw(raw);
            gmail.users().messages().send("me", message).execute();
        } catch (Exception e) {
            log.error("Failed to send email to {}", to, e);
        }
    }

    /**
     * Send an HTML email.
     */
    public void sendHtmlEmail(String to, String subject, String htmlBody) {
        if (gmail == null) {
            log.warn("Gmail not initialized, cannot send email");
            return;
        }

        try {
            var email = "To: " + to + "\r\n" +
                    "From: " + properties.google().gmailImpersonateEmail() + "\r\n" +
                    "Subject: " + subject + "\r\n" +
                    "Content-Type: text/html; charset=utf-8\r\n\r\n" +
                    htmlBody;

            var raw = Base64.getUrlEncoder().encodeToString(email.getBytes(StandardCharsets.UTF_8));
            var message = new Message().setRaw(raw);
            gmail.users().messages().send("me", message).execute();
        } catch (Exception e) {
            log.error("Failed to send HTML email to {}", to, e);
        }
    }

    /**
     * Send a reply to the original message so it appears in the same thread.
     * Uses In-Reply-To and References headers and threadId for proper threading.
     */
    public void sendReply(String to, String subject, String body, String threadId, String inReplyToMessageId) {
        if (gmail == null) {
            log.warn("Gmail not initialized, cannot send reply");
            return;
        }

        try {
            var sb = new StringBuilder();
            sb.append("To: ").append(to).append("\r\n");
            sb.append("From: ").append(properties.google().gmailImpersonateEmail()).append("\r\n");
            sb.append("Subject: ").append(subject).append("\r\n");
            if (inReplyToMessageId != null && !inReplyToMessageId.isBlank()) {
                sb.append("In-Reply-To: ").append(inReplyToMessageId).append("\r\n");
                sb.append("References: ").append(inReplyToMessageId).append("\r\n");
            }
            sb.append("Content-Type: text/plain; charset=utf-8\r\n\r\n");
            sb.append(body);

            var raw = Base64.getUrlEncoder().encodeToString(sb.toString().getBytes(StandardCharsets.UTF_8));
            var message = new Message().setRaw(raw);
            if (threadId != null && !threadId.isBlank()) {
                message.setThreadId(threadId);
            }
            gmail.users().messages().send("me", message).execute();
        } catch (Exception e) {
            log.error("Failed to send reply to {}", to, e);
        }
    }

    /**
     * Remove the UNREAD label from a message.
     * Same as gmail_service.py mark_as_read().
     */
    public void markAsRead(String messageId) {
        if (gmail == null) return;

        try {
            var request = new ModifyMessageRequest()
                    .setRemoveLabelIds(List.of("UNREAD"));
            gmail.users().messages().modify("me", messageId, request).execute();
        } catch (Exception e) {
            log.error("Failed to mark message {} as read", messageId, e);
        }
    }

    private static String getHeader(Map<String, String> headers, String name) {
        if (headers == null) return "";
        for (var e : headers.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) {
                return e.getValue() != null ? e.getValue() : "";
            }
        }
        return "";
    }

    /**
     * Recursively extract text/plain and text/html parts from MIME payload.
     * Same algorithm as gmail_service.py _extract_body().
     */
    private void extractBody(MessagePart payload, Map<String, String> body) {
        if (payload == null) return;

        var mimeType = payload.getMimeType();

        if ("text/plain".equals(mimeType) && body.get("text") == null) {
            var data = payload.getBody().getData();
            if (data != null) {
                body.put("text", new String(Base64.getUrlDecoder().decode(data), StandardCharsets.UTF_8));
            }
        } else if ("text/html".equals(mimeType) && body.get("html") == null) {
            var data = payload.getBody().getData();
            if (data != null) {
                body.put("html", new String(Base64.getUrlDecoder().decode(data), StandardCharsets.UTF_8));
            }
        }

        if (payload.getParts() != null) {
            for (var part : payload.getParts()) {
                extractBody(part, body);
            }
        }
    }
}
