-- Oramira OS — Migration 0063a: enum values from 0021, 0026, 0031 (own migration so they commit before use)
alter type user_role add value if not exists 'finance';
alter type user_role add value if not exists 'construction';
alter type user_role add value if not exists 'viewer';
alter type lead_status add value if not exists 'engaged' before 'qualified';
alter type lead_status add value if not exists 'offer' before 'negotiating';
alter type lead_status add value if not exists 'no_response';
alter type lead_status add value if not exists 'retargeting';
alter type lead_status add value if not exists 'reactivation';
