CREATE TABLE party_game_rooms (
    code VARCHAR(6) PRIMARY KEY,
    host_name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE party_game_participants (
    id BIGSERIAL PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES party_game_rooms(code) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_party_game_participant UNIQUE (room_code, member_name)
);

CREATE TABLE party_game_questions (
    id BIGSERIAL PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES party_game_rooms(code) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    category VARCHAR(40) NOT NULL,
    prompt VARCHAR(300) NOT NULL,
    play_order INTEGER,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_party_game_participants_room ON party_game_participants(room_code);
CREATE INDEX idx_party_game_questions_room ON party_game_questions(room_code);
