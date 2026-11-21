-- Καρτέλα υπαλλήλου (Staff → Υπάλληλοι): λήξη συνεργασίας, τύπος απασχόλησης και προσωπικά στοιχεία HR.
alter table profiles add column if not exists employment_end_date date;
alter table profiles add column if not exists termination_reason text;
alter table profiles add column if not exists employment_type text;
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists nationality text;
alter table profiles add column if not exists personal_email text;
alter table profiles add column if not exists social_insurance_no text;
alter table profiles add column if not exists hr_notes text;
