package com.neverempty.backend.service;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.NotFoundException;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.neverempty.backend.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Barcode detection and product lookup.
 * Adapts TestInvoiceParser/barcode_service.py:
 * - Detection: ZXing (Java) replaces pyzbar (Python)
 * - Lookup: same cascading strategy (Barcode Lookup → Open Food Facts → UPCitemdb)
 * - Uses RestTemplate instead of requests
 */
@Slf4j
@Service
public class BarcodeService {

    private final String barcodeLookupKey;
    private final RestTemplate restTemplate;

    public record BarcodeProduct(
            String barcode,
            String name,
            String brand,
            String description,
            String imageUrl,
            String source
    ) {}

    public BarcodeService(AppProperties properties) {
        this.barcodeLookupKey = properties.barcode().lookupKey();
        this.restTemplate = new RestTemplate();
    }

    /**
     * Detect barcodes in an image using ZXing.
     * Replaces pyzbar_decode from the Python reference.
     */
    public List<String> detectBarcodes(byte[] imageBytes) {
        try {
            var image = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (image == null) {
                return List.of();
            }

            var source = new BufferedImageLuminanceSource(image);
            var bitmap = new BinaryBitmap(new HybridBinarizer(source));

            var reader = new MultiFormatReader();
            var seen = new LinkedHashSet<String>();

            try {
                Result result = reader.decode(bitmap);
                seen.add(result.getText());
            } catch (NotFoundException e) {
                // no barcode found
            }

            return new ArrayList<>(seen);
        } catch (IOException e) {
            log.error("Failed to read image for barcode detection", e);
            return List.of();
        }
    }

    /**
     * Cascading product lookup: Barcode Lookup → Open Food Facts → UPCitemdb.
     * Same cascade logic as barcode_service.py lookup_product().
     */
    public Optional<BarcodeProduct> lookupProduct(String barcode) {
        if (barcodeLookupKey != null && !barcodeLookupKey.isBlank()) {
            var result = lookupBarcodeLookup(barcode);
            if (result.isPresent()) return result;
        }

        var result = lookupOpenFoodFacts(barcode);
        if (result.isPresent()) return result;

        return lookupUpcItemDb(barcode);
    }

    /**
     * Barcode Lookup API (primary, largest DB).
     * Same as barcode_service.py _lookup_barcodelookup().
     */
    @SuppressWarnings("unchecked")
    private Optional<BarcodeProduct> lookupBarcodeLookup(String barcode) {
        try {
            var url = "https://api.barcodelookup.com/v3/products?barcode={barcode}&key={key}";
            var response = restTemplate.getForObject(url, Map.class, barcode, barcodeLookupKey);
            if (response == null) return Optional.empty();

            var products = (List<Map<String, Object>>) response.get("products");
            if (products == null || products.isEmpty()) return Optional.empty();

            var product = products.get(0);
            var title = getStringOr(product, "title", getStringOr(product, "product_name", ""));
            if (title.isBlank()) return Optional.empty();

            var images = (List<String>) product.get("images");
            var imageUrl = (images != null && !images.isEmpty()) ? images.get(0) : "";

            return Optional.of(new BarcodeProduct(
                    barcode, title,
                    getStringOr(product, "brand", ""),
                    getStringOr(product, "description", ""),
                    imageUrl,
                    "Barcode Lookup"
            ));
        } catch (Exception e) {
            log.debug("Barcode Lookup API failed for {}: {}", barcode, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Open Food Facts (free, unlimited, food products).
     * Same as barcode_service.py _lookup_openfoodfacts().
     */
    @SuppressWarnings("unchecked")
    private Optional<BarcodeProduct> lookupOpenFoodFacts(String barcode) {
        try {
            var url = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json";
            var response = restTemplate.getForObject(url, Map.class, barcode);
            if (response == null) return Optional.empty();

            var status = response.get("status");
            if (!Integer.valueOf(1).equals(status)) return Optional.empty();

            var product = (Map<String, Object>) response.get("product");
            if (product == null) return Optional.empty();

            var name = getStringOr(product, "product_name", getStringOr(product, "product_name_en", ""));
            if (name.isBlank()) return Optional.empty();

            return Optional.of(new BarcodeProduct(
                    barcode, name,
                    getStringOr(product, "brands", ""),
                    getStringOr(product, "generic_name", ""),
                    getStringOr(product, "image_front_url", ""),
                    "Open Food Facts"
            ));
        } catch (Exception e) {
            log.debug("Open Food Facts API failed for {}: {}", barcode, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * UPCitemdb (free 100/day, all categories).
     * Same as barcode_service.py _lookup_upcitemdb().
     */
    @SuppressWarnings("unchecked")
    private Optional<BarcodeProduct> lookupUpcItemDb(String barcode) {
        try {
            var url = "https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}";
            var response = restTemplate.getForObject(url, Map.class, barcode);
            if (response == null) return Optional.empty();

            var items = (List<Map<String, Object>>) response.get("items");
            if (items == null || items.isEmpty()) return Optional.empty();

            var item = items.get(0);
            var images = (List<String>) item.get("images");
            var imageUrl = (images != null && !images.isEmpty()) ? images.get(0) : "";

            return Optional.of(new BarcodeProduct(
                    barcode,
                    getStringOr(item, "title", ""),
                    getStringOr(item, "brand", ""),
                    getStringOr(item, "description", ""),
                    imageUrl,
                    "UPCitemdb"
            ));
        } catch (Exception e) {
            log.debug("UPCitemdb API failed for {}: {}", barcode, e.getMessage());
            return Optional.empty();
        }
    }

    private static String getStringOr(Map<String, Object> map, String key, String defaultValue) {
        var value = map.get(key);
        return value instanceof String s && !s.isBlank() ? s : defaultValue;
    }
}
