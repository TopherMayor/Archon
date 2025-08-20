-- Migration to add agent_name to tasks table
ALTER TABLE tasks
ADD COLUMN agent_name TEXT;

COMMENT ON COLUMN tasks.agent_name IS 'The name of the AI agent client that created or last modified the task.';
