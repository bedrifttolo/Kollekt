CREATE TABLE social_identities (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT uk_social_identity_provider_subject UNIQUE (provider, provider_subject)
);

CREATE INDEX idx_social_identities_member_id ON social_identities(member_id);
