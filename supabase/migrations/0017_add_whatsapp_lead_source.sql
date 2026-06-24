-- Oramira OS — Migration 0017: add 'whatsapp' as a lead source
-- Additive (don't edit 0001–0016). The lead_source enum (0001) gains a value
-- so leads/website-intake can be tagged as WhatsApp-originated.
alter type lead_source add value if not exists 'whatsapp';
