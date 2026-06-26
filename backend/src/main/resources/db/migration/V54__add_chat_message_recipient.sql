-- Direct (1:1) messages. A NULL recipient is a normal household-wide message (the existing
-- behaviour, so all current rows stay household messages). A non-NULL recipient marks a private
-- message between `sender` and `recipient`, both members of the same collective.
ALTER TABLE chat_messages ADD COLUMN recipient VARCHAR(255);
