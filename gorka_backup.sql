--
-- PostgreSQL database dump
--

\restrict obkbvdBb2TvbbljprU2PDdPmhVPtUykHYQI2F39O7Lzo0UfsXlvPQj7RCba3a67

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.actions OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: ai_feedback; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.ai_feedback OWNER TO postgres;

--
-- Name: ai_outcomes; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.ai_outcomes OWNER TO postgres;

--
-- Name: ai_recommendations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.ai_recommendations OWNER TO postgres;

--
-- Name: communication_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.communication_history OWNER TO postgres;

--
-- Name: debtors; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.debtors OWNER TO postgres;

--
-- Name: message_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.message_logs OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: queue_jobs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.queue_jobs OWNER TO postgres;

--
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.templates OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.actions (id, organization_id, type, status, title, description, metadata, assigned_to, completed_at, created_at, debtor_id, due_date, updated_at) FROM stdin;
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, organization_id, action, details, created_at, entity_id, entity_type, ip_address, user_agent, user_id) FROM stdin;
\.


--
-- Data for Name: ai_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_feedback (id, organization_id, rating, comment, agent_id, created_at, recommendation_id) FROM stdin;
\.


--
-- Data for Name: ai_outcomes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_outcomes (id, organization_id, amount, agent_id, agent_notes, agent_rating, debtor_id, outcome_status, promise_date, recommendation_id, recorded_at) FROM stdin;
\.


--
-- Data for Name: ai_recommendations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_recommendations (id, organization_id, channel, tone, rationale, status, accepted_at, agent_id, context_hash, created_at, debtor_id, email_body, email_subject, expires_at, generated_at, model_version, prompt_version, rejected_at, sent_at, updated_at) FROM stdin;
\.


--
-- Data for Name: communication_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.communication_history (id, organization_id, channel, type, subject, content, status, metadata, created_at, debtor_id, delivered_at, error_message, read_at, sent_at, updated_at) FROM stdin;
\.


--
-- Data for Name: debtors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.debtors (id, name, email, phone, address, identification, tags, status, organization_id, metadata, assigned_to, created_at, date_of_birth, deleted_at, risk_score, updated_at) FROM stdin;
\.


--
-- Data for Name: message_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_logs (id, organization_id, channel, direction, subject, content, status, provider, metadata, created_at, debtor_id, delivered_at, provider_id, read_at, sent_at, updated_at, user_id) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, slug, email, phone, address, website, industry, status, settings, created_at, deleted_at, updated_at) FROM stdin;
org_123	GORKA Organization	gorka	\N	\N	\N	\N	\N	ACTIVE	{}	2026-08-14 04:57:05.593	\N	2026-08-14 04:49:23.939
\.


--
-- Data for Name: queue_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queue_jobs (id, data, status, attempts, organization_id, completed_at, created_at, error_message, failed_at, max_attempts, queue_name, scheduled_at, started_at, updated_at) FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.templates (id, name, subject, content, channel, type, description, variables, status, organization_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, name, role, status, organization_id, created_at, deleted_at, last_login_at, updated_at) FROM stdin;
cmsshbipg00012t91clfdau5j	admin@gorka.click	$2b$10$qtRGPOX9oK0U/tUqzlEJIOebelCjBcVwua4Rwd1SpH5GZxPjv9Cky	SuperAdmin	SUPER_ADMIN	ACTIVE	org_123	2026-08-14 05:00:59.38	\N	2026-08-14 06:03:30.037	2026-08-14 06:03:30.04
\.


--
-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_feedback ai_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_pkey PRIMARY KEY (id);


--
-- Name: ai_outcomes ai_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_pkey PRIMARY KEY (id);


--
-- Name: ai_recommendations ai_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_pkey PRIMARY KEY (id);


--
-- Name: communication_history communication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_pkey PRIMARY KEY (id);


--
-- Name: debtors debtors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_pkey PRIMARY KEY (id);


--
-- Name: message_logs message_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: queue_jobs queue_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_jobs
    ADD CONSTRAINT queue_jobs_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: actions_debtor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX actions_debtor_id_idx ON public.actions USING btree (debtor_id);


--
-- Name: actions_due_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX actions_due_date_idx ON public.actions USING btree (due_date);


--
-- Name: actions_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX actions_status_idx ON public.actions USING btree (status);


--
-- Name: activity_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs USING btree (created_at);


--
-- Name: activity_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_user_id_idx ON public.activity_logs USING btree (user_id);


--
-- Name: ai_outcomes_debtor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_outcomes_debtor_id_idx ON public.ai_outcomes USING btree (debtor_id);


--
-- Name: ai_recommendations_debtor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_recommendations_debtor_id_idx ON public.ai_recommendations USING btree (debtor_id);


--
-- Name: ai_recommendations_generated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_recommendations_generated_at_idx ON public.ai_recommendations USING btree (generated_at);


--
-- Name: ai_recommendations_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_recommendations_status_idx ON public.ai_recommendations USING btree (status);


--
-- Name: communication_history_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX communication_history_created_at_idx ON public.communication_history USING btree (created_at);


--
-- Name: communication_history_debtor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX communication_history_debtor_id_idx ON public.communication_history USING btree (debtor_id);


--
-- Name: communication_history_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX communication_history_status_idx ON public.communication_history USING btree (status);


--
-- Name: message_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_logs_created_at_idx ON public.message_logs USING btree (created_at);


--
-- Name: message_logs_debtor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_logs_debtor_id_idx ON public.message_logs USING btree (debtor_id);


--
-- Name: message_logs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_logs_status_idx ON public.message_logs USING btree (status);


--
-- Name: organizations_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);


--
-- Name: queue_jobs_scheduled_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX queue_jobs_scheduled_at_idx ON public.queue_jobs USING btree (scheduled_at);


--
-- Name: queue_jobs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX queue_jobs_status_idx ON public.queue_jobs USING btree (status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: actions actions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: actions actions_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: actions actions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_feedback ai_feedback_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.ai_recommendations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_outcomes ai_outcomes_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_outcomes ai_outcomes_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_outcomes
    ADD CONSTRAINT ai_outcomes_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.ai_recommendations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_recommendations ai_recommendations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_recommendations ai_recommendations_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_recommendations ai_recommendations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: communication_history communication_history_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: communication_history communication_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: debtors debtors_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: debtors debtors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: queue_jobs queue_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_jobs
    ADD CONSTRAINT queue_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: templates templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict obkbvdBb2TvbbljprU2PDdPmhVPtUykHYQI2F39O7Lzo0UfsXlvPQj7RCba3a67

