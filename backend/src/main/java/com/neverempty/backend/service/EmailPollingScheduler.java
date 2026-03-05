package com.neverempty.backend.service;

import com.neverempty.backend.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Polls the Gmail inbox for forwarded purchase emails,
 * matches sender to a registered user by their notification email (household is determined by that user),
 * imports products and sends a confirmation as a reply to the forwarded message.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailPollingScheduler {

    private final EmailParserService emailParserService;
    private final ImportService importService;
    private final UserSettingsRepository userSettingsRepository;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("<([^>]+)>|([\\w.+-]+@[\\w.-]+)");

    @Scheduled(fixedDelayString = "${app.email-poll-interval-ms:10000}")
    public void pollInbox() {
        var emails = emailParserService.getUnreadEmails(10);
        if (emails.isEmpty()) return;

        log.info("Email poll: found {} unread messages", emails.size());
        for (var email : emails) {
            if (email == null) continue;
            try {
                processEmail(email);
            } catch (Exception e) {
                log.error("Failed to process email '{}' from {}", email.subject(), email.from(), e);
            }
        }
    }

    private void processEmail(EmailParserService.EmailMessage email) {
        var senderEmail = extractEmailAddress(email.from());
        if (senderEmail == null) {
            log.warn("Could not extract sender email from: {}", email.from());
            emailParserService.markAsRead(email.id());
            return;
        }

        log.info("Processing email from {} (subject: {})", senderEmail, email.subject());

        var userSettings = userSettingsRepository.findByNotification_Email(senderEmail);
        if (userSettings.isEmpty()) {
            log.warn("No registered user for sender email: {}. Skipping.", senderEmail);
            emailParserService.markAsRead(email.id());
            // Optionally reply that they need to register
            emailParserService.sendEmail(senderEmail,
                    "NeverEmpty: Email not recognized",
                    "We received your email but couldn't match it to a registered account.\n\n" +
                    "Please make sure the email address you're forwarding from matches " +
                    "the notification email in your NeverEmpty settings.");
            return;
        }

        var userId = userSettings.get().getUserId();
        var content = email.bodyText() != null ? email.bodyText() : email.bodyHtml();
        if (content == null || content.isBlank()) {
            log.warn("Email from {} has no body content", senderEmail);
            emailParserService.markAsRead(email.id());
            return;
        }

        var result = importService.importFromEmail(userId, content);

        // Send confirmation
        var itemNames = result.importedItems().stream()
                .map(item -> "  - " + item.getName() + " (" + item.getCurrentQuantity() + " " + item.getUnit() + ")")
                .toList();

        var body = new StringBuilder();
        body.append("We've processed your forwarded email and imported ")
                .append(result.importedItems().size())
                .append(" products:\n\n");
        itemNames.forEach(name -> body.append(name).append("\n"));

        if (!result.unrecognizedLines().isEmpty()) {
            body.append("\nSkipped lines:\n");
            result.unrecognizedLines().forEach(line -> body.append("  - ").append(line).append("\n"));
        }

        body.append("\nView your inventory at https://neverempty.app/products");

        var replySubject = email.subject() != null && !email.subject().isBlank()
                ? (email.subject().trim().toLowerCase().startsWith("re:") ? "" : "Re: ") + email.subject().trim()
                : "Re: Import successful";

        emailParserService.sendReply(
                senderEmail,
                replySubject,
                body.toString(),
                email.threadId(),
                email.messageIdHeader()
        );
        emailParserService.markAsRead(email.id());

        log.info("Imported {} items for user {} from email", result.importedItems().size(), userId);
    }

    /**
     * Extract email address from "From" header.
     * Handles formats like: "John Doe <john@example.com>" and "john@example.com"
     */
    static String extractEmailAddress(String from) {
        if (from == null || from.isBlank()) return null;
        Matcher matcher = EMAIL_PATTERN.matcher(from);
        if (matcher.find()) {
            return matcher.group(1) != null ? matcher.group(1).toLowerCase() : matcher.group(2).toLowerCase();
        }
        return null;
    }
}
