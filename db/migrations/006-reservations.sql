-- RF-04 a RF-06. La exclusión decide incluso entre transacciones simultáneas.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE audiovisual.reservations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES audiovisual.users (id) ON DELETE RESTRICT,
  unit_id integer NOT NULL REFERENCES audiovisual.units (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'
    CONSTRAINT reservations_status_allowed CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT reservations_valid_interval CHECK (
    isfinite(starts_at) AND isfinite(ends_at) AND starts_at < ends_at
  ),
  CONSTRAINT reservations_cancellation_consistent CHECK (
    (status = 'confirmed' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX reservations_user_idx ON audiovisual.reservations (user_id, starts_at DESC, id DESC);
