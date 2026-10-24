# Demo patient data

`synthea-patients.json` holds the 99 living patients from Synthea's sample data set, converted by `scripts/import-synthea.mjs`. `npm run seed` loads them.

**Why Synthea.** Real patient records cannot be published or shared, even de-identified ones from Indian hospitals, without an ethics approval and a data-use agreement. [Synthea](https://synthea.mitre.org) (MITRE, Apache-2.0) simulates whole patient lives from published disease and care statistics, so every record reads like a real chart (chronic conditions with matching medicines, allergies with reactions and severity, vitals from dated visits) but belongs to no real person. It is the standard open data set for health-software demos and testing.

**Where each field comes from**

| Field | Source |
|---|---|
| Date of birth, sex | Synthea |
| Allergies (allergen, reaction, severity) | Synthea, current allergies only; reactions reworded in plain English ("Wheal" → "Hives") |
| Medications (name, strength, start date) | Synthea, current prescriptions only, newest five |
| Frequency | Usual dosing for that medicine (Synthea does not record it) |
| Vitals (heart rate, BP, temperature, breathing rate, SpO₂) | Synthea, the last three visits, on their real dates |
| Name, phone number | Common Maharashtra names and Indian mobile numbers, chosen from a hash of the Synthea id (Synthea generates US names) |
| Blood group | India's ABO/Rh mix, chosen the same way (Synthea does not record one) |

To regenerate from a newer download:

```bash
curl -LO https://synthetichealth.github.io/synthea-sample-data/downloads/latest/synthea_sample_data_csv_latest.zip
unzip synthea_sample_data_csv_latest.zip -d synthea
node scripts/import-synthea.mjs synthea
```
