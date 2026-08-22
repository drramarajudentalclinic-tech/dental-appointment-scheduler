# Dental Appointment Scheduler

A small React + Supabase appointment scheduler for a dental clinic.

## Included

- Doctor and receptionist login
- Add appointment
- Edit appointment
- Mark completed
- Cancel appointment
- Permanent delete
- Today / Future / Completed / All filters
- Search by patient name, mobile, treatment, case number or doctor
- Doctor filter
- Previous/next day navigation
- Realtime synchronization between doctor and receptionist browsers
- Mobile responsive UI
- Database-level protection against same doctor + same date + same time
- Same time is allowed for different doctors
- GitHub Pages deployment workflow

## Appointment fields

Mandatory:
- Patient name
- Mobile number
- Date
- Time
- Doctor name

Optional:
- Age
- Treatment
- Case number

## 1. Create Supabase project

Create a Supabase project.

Then open:

Supabase Dashboard -> SQL Editor

Paste and run:

supabase/schema.sql

## 2. Create users

Go to:

Supabase Dashboard -> Authentication -> Users

Create the doctor and receptionist users.

The database trigger automatically creates a profile.

You can then edit `public.profiles` if you want to change:

- full_name
- role

Roles supported:
- doctor
- receptionist

## 3. Get Supabase API settings

Open:

Supabase Dashboard -> Project Settings -> API

Copy:
- Project URL
- Publishable key

Do NOT put the service_role key in this React app.

## 4. Run locally

Install Node.js 20+.

From this project folder:

```bash
npm install
```

Create:

```text
.env.local
```

Example:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Then:

```bash
npm run dev
```

Open the local URL shown by Vite.

## 5. Test realtime

Open the application in two browser windows.

Window 1:
- Login as doctor.

Window 2:
- Login as receptionist.

Add an appointment in one window.

The other window should update automatically.

## 6. Test same-time booking

This is intentional:

```text
24 Aug 2026 | 10:30 | Dr. Rama Raju | Ravi      -> allowed
24 Aug 2026 | 10:30 | Dr. Suresh    | Priya     -> allowed
24 Aug 2026 | 10:30 | Dr. Rama Raju | Arun      -> blocked
```

The database unique index is responsible for the final protection, not only the frontend.

## 7. GitHub Pages deployment

Create a GitHub repository and push the project.

In GitHub:

Settings -> Secrets and variables -> Actions

Add repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Then:

Settings -> Pages

Set the source to:

GitHub Actions

Push to `main`.

The workflow in:

```text
.github/workflows/deploy.yml
```

will build and deploy the app.

## Important production notes

This starter is designed for a small clinic appointment scheduler.

Before using it with real patient information, review:
- Supabase account security
- strong passwords
- MFA for administrator accounts
- RLS policies
- backup strategy
- privacy/legal requirements applicable to your clinic
- free-tier limits and availability

The application uses the Supabase publishable key in the browser. Never expose the Supabase service_role/secret key in frontend code.

## Future upgrade path

The current version stores `doctor_name` directly in each appointment.

Later, when the clinic needs proper doctor management, we can migrate to:

```text
doctors
  id
  name
  specialization
  active
```

and then use:

```text
appointments.doctor_id
```

without redesigning the entire application.
