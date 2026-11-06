-- Oramira OS — Migration 0063c: τιμές που έλειπαν από τη βάση (0017–0019 δεν είχαν τρέξει ποτέ).
alter type lead_source add value if not exists 'whatsapp';
alter type lead_status add value if not exists 'viewing' before 'offer';
alter type lead_status add value if not exists 'waiting' before 'viewing';
