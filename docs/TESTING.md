# Testing checklist

## Authentication

- [ ] Doctor can log in.
- [ ] Receptionist can log in.
- [ ] Logout works.
- [ ] Wrong password is rejected.

## Create

- [ ] Name required.
- [ ] Mobile required.
- [ ] Date required.
- [ ] Time required.
- [ ] Doctor required.
- [ ] Age optional.
- [ ] Treatment optional.
- [ ] Case number optional.

## Scheduling

- [ ] Same doctor + same date + same time is blocked.
- [ ] Same date + same time + different doctor is allowed.
- [ ] Cancelled slot can be reused.

## Updates

- [ ] Edit patient.
- [ ] Edit mobile.
- [ ] Edit date/time.
- [ ] Edit doctor.
- [ ] Edit treatment.
- [ ] Mark completed.
- [ ] Cancel.
- [ ] Delete.

## Filters

- [ ] Today.
- [ ] Future.
- [ ] Completed.
- [ ] All.
- [ ] Search.
- [ ] Doctor filter.
- [ ] Previous day.
- [ ] Next day.

## Realtime

Open two browser windows.

- [ ] Doctor adds appointment -> receptionist sees it.
- [ ] Receptionist adds appointment -> doctor sees it.
- [ ] Doctor edits -> receptionist sees update.
- [ ] Receptionist completes -> doctor sees completed.
- [ ] Cancellation appears in both windows.

## Mobile

- [ ] Test on Android Chrome.
- [ ] Test adding appointment.
- [ ] Test editing.
- [ ] Test filters.
- [ ] Test logout.
