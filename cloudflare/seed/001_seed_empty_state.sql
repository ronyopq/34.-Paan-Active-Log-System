-- Optional initial row (can be skipped)
INSERT INTO app_state (state_key, state_json)
VALUES ('latest', '{}')
ON CONFLICT(state_key) DO NOTHING;
