DROP TABLE IF EXISTS order_attachments CASCADE;
CREATE TABLE order_attachments (id BIGSERIAL PRIMARY KEY,order_id TEXT NOT NULL,file_name TEXT NOT NULL,file_type TEXT NOT NULL,file_size BIGINT DEFAULT 0,file_data TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX idx_order_attachments_order_id ON order_attachments(order_id);
CREATE INDEX idx_order_attachments_created_at ON order_attachments(created_at);