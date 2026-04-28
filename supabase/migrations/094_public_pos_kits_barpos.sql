-- Allows each public POS kit to state whether BARpos software is included.

ALTER TABLE public_pos_kits
  ADD COLUMN IF NOT EXISTS barpos_included BOOLEAN NOT NULL DEFAULT FALSE;
