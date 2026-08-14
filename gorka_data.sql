--
-- PostgreSQL database dump
--

\restrict XvDEkF5wOFvsrghIRDVgY7WH6ZgszZamCdpMh1S7rRtMsVoeNgGSeaIQjmd7xOK

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
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.organizations VALUES ('org_123', 'GORKA Organization', 'gorka', NULL, NULL, NULL, NULL, NULL, 'ACTIVE', '{}', '2026-08-14 04:57:05.593', NULL, '2026-08-14 04:49:23.939');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('cmsshbipg00012t91clfdau5j', 'admin@gorka.click', '$2b$10$qtRGPOX9oK0U/tUqzlEJIOebelCjBcVwua4Rwd1SpH5GZxPjv9Cky', 'SuperAdmin', 'SUPER_ADMIN', 'ACTIVE', 'org_123', '2026-08-14 05:00:59.38', NULL, '2026-08-14 06:03:30.037', '2026-08-14 06:03:30.04');


--
-- Data for Name: debtors; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: actions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_recommendations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_outcomes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: communication_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: queue_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

\unrestrict XvDEkF5wOFvsrghIRDVgY7WH6ZgszZamCdpMh1S7rRtMsVoeNgGSeaIQjmd7xOK

