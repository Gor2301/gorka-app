--
-- PostgreSQL database dump
--

\restrict VfIzJGFYQFkqYBMOmDfjEhv405qIWpDpD4Ssze6utYVsYcGdabcJvFEBCYfxMgR

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actions (
    id text NOT NULL,
    organization_id text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    title text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    assigned_to text,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    debtor_id text NOT NULL,
    due_date timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    organization_id text NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    entity_id text,
    entity_type text,
    ip_address text,
    user_agent text,
    user_id text
);


--
-- Name: ai_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feedback (
    id text NOT NULL,
    organization_id text NOT NULL,
    rating integer NOT NULL,
    comment text,
    agent_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recommendation_id text NOT NULL
);


--
-- Name: ai_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_outcomes (
    id text NOT NULL,
    organization_id text NOT NULL,
    amount double precision,
    agent_id text,
    agent_notes text,
    agent_rating integer,
    debtor_id text NOT NULL,
    outcome_status text NOT NULL,
    promise_date timestamp(3) without time zone,
    recommendation_id text,
    recorded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ai_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_recommendations (
    id text NOT NULL,
    organization_id text NOT NULL,
    channel text NOT NULL,
    tone text NOT NULL,
    rationale text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    accepted_at timestamp(3) without time zone,
    agent_id text,
    context_hash text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    debtor_id text NOT NULL,
    email_body text,
    email_subject text,
    expires_at timestamp(3) without time zone,
    generated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    model_version text,
    prompt_version text,
    rejected_at timestamp(3) without time zone,
    sent_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: communication_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_history (
    id text NOT NULL,
    organization_id text NOT NULL,
    channel text NOT NULL,
    type text NOT NULL,
    subject text,
    content text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    debtor_id text NOT NULL,
    delivered_at timestamp(3) without time zone,
    error_message text,
    read_at timestamp(3) without time zone,
    sent_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: debtors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debtors (
    id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    identification jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT ARRAY[]::text[],
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    organization_id text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    assigned_to text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_of_birth timestamp(3) without time zone,
    deleted_at timestamp(3) without time zone,
    risk_score integer DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: message_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_logs (
    id text NOT NULL,
    organization_id text NOT NULL,
    channel text NOT NULL,
    direction text DEFAULT 'OUTBOUND'::text NOT NULL,
    subject text,
    content text,
    status text DEFAULT 'SENT'::text NOT NULL,
    provider text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    debtor_id text NOT NULL,
    delivered_at timestamp(3) without time zone,
    provider_id text,
    read_at timestamp(3) without time zone,
    sent_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    slug text,
    email text,
    phone text,
    address text,
    website text,
    industry text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: queue_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_jobs (
    id text NOT NULL,
    data jsonb NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    organization_id text,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    error_message text,
    failed_at timestamp(3) without time zone,
    max_attempts integer DEFAULT 3 NOT NULL,
    queue_name text NOT NULL,
    scheduled_at timestamp(3) without time zone,
    started_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id text NOT NULL,
    name text NOT NULL,
    subject text,
    content text NOT NULL,
    channel text NOT NULL,
    type text DEFAULT 'CUSTOM'::text NOT NULL,
    description text,
    variables text[] DEFAULT ARRAY[]::text[],
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text,
    role text DEFAULT 'AGENT'::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_feedback ai_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_pkey PRIMARY KEY (id);


--
-- Name: ai_outcomes ai_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_pkey PRIMARY KEY (id);


--
-- Name: ai_recommendations ai_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_pkey PRIMARY KEY (id);


--
-- Name: communication_history communication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_pkey PRIMARY KEY (id);


--
-- Name: debtors debtors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_pkey PRIMARY KEY (id);


--
-- Name: message_logs message_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: queue_jobs queue_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_jobs
    ADD CONSTRAINT queue_jobs_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: actions_debtor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX actions_debtor_id_idx ON public.actions USING btree (debtor_id);


--
-- Name: actions_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX actions_due_date_idx ON public.actions USING btree (due_date);


--
-- Name: actions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX actions_status_idx ON public.actions USING btree (status);


--
-- Name: activity_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs USING btree (created_at);


--
-- Name: activity_logs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_user_id_idx ON public.activity_logs USING btree (user_id);


--
-- Name: ai_outcomes_debtor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_outcomes_debtor_id_idx ON public.ai_outcomes USING btree (debtor_id);


--
-- Name: ai_recommendations_debtor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_recommendations_debtor_id_idx ON public.ai_recommendations USING btree (debtor_id);


--
-- Name: ai_recommendations_generated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_recommendations_generated_at_idx ON public.ai_recommendations USING btree (generated_at);


--
-- Name: ai_recommendations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_recommendations_status_idx ON public.ai_recommendations USING btree (status);


--
-- Name: communication_history_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_history_created_at_idx ON public.communication_history USING btree (created_at);


--
-- Name: communication_history_debtor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_history_debtor_id_idx ON public.communication_history USING btree (debtor_id);


--
-- Name: communication_history_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_history_status_idx ON public.communication_history USING btree (status);


--
-- Name: message_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_logs_created_at_idx ON public.message_logs USING btree (created_at);


--
-- Name: message_logs_debtor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_logs_debtor_id_idx ON public.message_logs USING btree (debtor_id);


--
-- Name: message_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_logs_status_idx ON public.message_logs USING btree (status);


--
-- Name: organizations_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);


--
-- Name: queue_jobs_scheduled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX queue_jobs_scheduled_at_idx ON public.queue_jobs USING btree (scheduled_at);


--
-- Name: queue_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX queue_jobs_status_idx ON public.queue_jobs USING btree (status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: actions actions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: actions actions_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: actions actions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_feedback ai_feedback_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.ai_recommendations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_outcomes ai_outcomes_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.ai_recommendations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_recommendations ai_recommendations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_recommendations ai_recommendations_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_recommendations ai_recommendations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: communication_history communication_history_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: communication_history communication_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: debtors debtors_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: debtors debtors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: queue_jobs queue_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_jobs
    ADD CONSTRAINT queue_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: templates templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict VfIzJGFYQFkqYBMOmDfjEhv405qIWpDpD4Ssze6utYVsYcGdabcJvFEBCYfxMgR

