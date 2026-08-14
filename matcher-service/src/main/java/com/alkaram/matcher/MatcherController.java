package com.alkaram.matcher;

import com.machinezoo.sourceafis.FingerprintImage;
import com.machinezoo.sourceafis.FingerprintImageOptions;
import com.machinezoo.sourceafis.FingerprintMatcher;
import com.machinezoo.sourceafis.FingerprintTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/match")
@CrossOrigin(origins = "*") // Allow requests from Node.js or anywhere
public class MatcherController {

    /**
     * Helper to decode Base64 and build a SourceAFIS Template.
     */
    private FingerprintTemplate extractTemplateFromPngBase64(String base64Png) {
        byte[] imageBytes = Base64.getDecoder().decode(base64Png);
        FingerprintImage image = new FingerprintImage(imageBytes, new FingerprintImageOptions().dpi(500));
        return new FingerprintTemplate(image);
    }

    /**
     * Create a serialized SourceAFIS template from a PNG image.
     */
    @PostMapping("/template/create")
    public Map<String, Object> createTemplate(@RequestBody Map<String, String> payload) {
        Map<String, Object> response = new HashMap<>();
        try {
            long startTime = System.currentTimeMillis();
            String base64Png = payload.get("png");
            if (base64Png == null || base64Png.isEmpty()) {
                response.put("success", false);
                response.put("message", "No 'png' provided in payload");
                return response;
            }

            FingerprintTemplate template = extractTemplateFromPngBase64(base64Png);
            byte[] serialized = template.toByteArray();
            String serializedBase64 = Base64.getEncoder().encodeToString(serialized);

            long elapsed = System.currentTimeMillis() - startTime;

            response.put("success", true);
            response.put("template", serializedBase64);
            response.put("processingTimeMs", elapsed);
            return response;
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error creating template: " + e.getMessage());
            return response;
        }
    }

    /**
     * Verify a probe PNG against a candidate serialized template (1:1).
     */
    @PostMapping("/verify")
    public Map<String, Object> verify(@RequestBody Map<String, String> payload) {
        Map<String, Object> response = new HashMap<>();
        try {
            long startTime = System.currentTimeMillis();
            
            String probePng = payload.get("probePng");
            String candidateTemplateBase64 = payload.get("candidateTemplate");
            
            if (probePng == null || candidateTemplateBase64 == null) {
                response.put("success", false);
                response.put("message", "Missing probePng or candidateTemplate");
                return response;
            }

            // Extract template from probe PNG
            FingerprintTemplate probeTemplate = extractTemplateFromPngBase64(probePng);
            
            // Deserialize candidate template
            byte[] candidateBytes = Base64.getDecoder().decode(candidateTemplateBase64);
            FingerprintTemplate candidateTemplate = new FingerprintTemplate(candidateBytes);

            // Match
            FingerprintMatcher matcher = new FingerprintMatcher(probeTemplate);
            double similarity = matcher.match(candidateTemplate);

            long elapsed = System.currentTimeMillis() - startTime;

            response.put("success", true);
            response.put("score", similarity);
            response.put("processingTimeMs", elapsed);
            return response;
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error matching: " + e.getMessage());
            return response;
        }
    }

    /**
     * Identify a probe PNG against a list of candidates (1:N).
     * Expected payload: { "probePng": "...", "candidates": [ { "id": "emp1", "template": "..." } ] }
     */
    @PostMapping("/identify")
    public Map<String, Object> identify(@RequestBody IdentifyRequest payload) {
        Map<String, Object> response = new HashMap<>();
        try {
            long startTime = System.currentTimeMillis();
            
            String probePng = payload.probePng;
            List<Candidate> candidates = payload.candidates;

            if (probePng == null || candidates == null || candidates.isEmpty()) {
                response.put("success", false);
                response.put("message", "Missing probePng or candidates array");
                return response;
            }

            // Extract probe template
            FingerprintTemplate probeTemplate = extractTemplateFromPngBase64(probePng);
            FingerprintMatcher matcher = new FingerprintMatcher(probeTemplate);

            double bestScore = 0;
            String bestMatchId = null;

            for (Candidate candidate : candidates) {
                byte[] candBytes = Base64.getDecoder().decode(candidate.template);
                FingerprintTemplate candTemplate = new FingerprintTemplate(candBytes);
                
                double score = matcher.match(candTemplate);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatchId = candidate.id;
                }
            }

            long elapsed = System.currentTimeMillis() - startTime;

            response.put("success", true);
            response.put("score", bestScore);
            response.put("matchId", bestMatchId);
            response.put("processingTimeMs", elapsed);
            return response;
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error matching: " + e.getMessage());
            return response;
        }
    }

    // DTOs for Identify request
    public static class IdentifyRequest {
        public String probePng;
        public List<Candidate> candidates;
    }

    public static class Candidate {
        public String id;
        public String template;
    }
}
