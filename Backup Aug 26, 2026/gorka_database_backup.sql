--
-- PostgreSQL database dump
--

\restrict tIirfv64Bsjwf67d41vtevzhLKSvjrdvf4dchW3BLom8tpqGgabJVYvMs7AVKHI

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
-- Name: Action; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Action" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    priority integer DEFAULT 1,
    status text DEFAULT 'PENDING'::text,
    "assignedToId" uuid NOT NULL,
    "debtorId" uuid NOT NULL,
    "debtId" uuid,
    "dueDate" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Action" OWNER TO postgres;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    action text NOT NULL,
    details text,
    "ipAddress" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."AuditLog" OWNER TO postgres;

--
-- Name: Debt; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Debt" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    description text,
    "dueDate" timestamp without time zone,
    status text DEFAULT 'ACTIVE'::text,
    "debtorId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Debt" OWNER TO postgres;

--
-- Name: Debtor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Debtor" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text,
    email text,
    address text,
    city text,
    country text,
    "organizationId" uuid NOT NULL,
    "assignedToId" uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Debtor" OWNER TO postgres;

--
-- Name: Document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Document" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "fileName" text NOT NULL,
    "filePath" text NOT NULL,
    "fileType" text NOT NULL,
    "fileSize" integer NOT NULL,
    "debtorId" uuid NOT NULL,
    "uploadedById" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Document" OWNER TO postgres;

--
-- Name: Interaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Interaction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    channel text,
    subject text,
    content text NOT NULL,
    direction text DEFAULT 'OUTGOING'::text,
    "debtorId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Interaction" OWNER TO postgres;

--
-- Name: JobQueue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."JobQueue" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'PENDING'::text,
    payload text,
    result text,
    error text,
    "lockedAt" timestamp without time zone,
    "processedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."JobQueue" OWNER TO postgres;

--
-- Name: Organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Organization" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Organization" OWNER TO postgres;

--
-- Name: ServiceStatus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServiceStatus" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" text NOT NULL,
    "serviceName" text NOT NULL,
    status text DEFAULT 'HEALTHY'::text NOT NULL,
    "statusMessage" text,
    "lastCheck" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "responseTime" integer
);


ALTER TABLE public."ServiceStatus" OWNER TO postgres;

--
-- Name: StatusHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."StatusHistory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" text NOT NULL,
    "serviceName" text NOT NULL,
    status text NOT NULL,
    "responseTime" integer,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StatusHistory" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    "organizationId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions (
    id text NOT NULL,
    "debtorId" text NOT NULL,
    "assignedTo" text NOT NULL,
    type text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    description text,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "triggerEmail" boolean DEFAULT false NOT NULL,
    "emailTemplateId" text,
    "emailDelayHours" integer DEFAULT 0 NOT NULL,
    "messageLogId" text,
    "triggerSms" boolean DEFAULT false NOT NULL,
    "smsTemplateId" text,
    "smsDelayHours" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.actions OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    details jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_events (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "debtorId" text,
    title text NOT NULL,
    description text,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    type text DEFAULT 'TASK'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    source text,
    "sourceId" text,
    "sourceDate" timestamp(3) without time zone,
    "allDay" boolean DEFAULT false NOT NULL,
    "eventType" text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.calendar_events OWNER TO postgres;

--
-- Name: connectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connectors (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    status text DEFAULT 'DISCONNECTED'::text NOT NULL,
    config text NOT NULL,
    credentials text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    description text,
    category text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL,
    "lastTestedAt" timestamp(3) without time zone
);


ALTER TABLE public.connectors OWNER TO postgres;

--
-- Name: debtors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.debtors (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    "totalDebt" double precision,
    "daysOverdue" integer,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "nextFollowUpDate" timestamp(3) without time zone,
    "nextPaymentDate" timestamp(3) without time zone
);


ALTER TABLE public.debtors OWNER TO postgres;

--
-- Name: debts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.debts (
    id text NOT NULL,
    "debtorId" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.debts OWNER TO postgres;

--
-- Name: external_enrichments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_enrichments (
    id text NOT NULL,
    "connectorId" text NOT NULL,
    "debtorId" text NOT NULL,
    "organizationId" text NOT NULL,
    "externalScore" integer,
    "riskLevel" text,
    "externalStatus" text,
    "retrievedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.external_enrichments OWNER TO postgres;

--
-- Name: message_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_events (
    id text NOT NULL,
    "messageLogId" text NOT NULL,
    event text NOT NULL,
    data jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.message_events OWNER TO postgres;

--
-- Name: message_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_logs (
    id text NOT NULL,
    "jobId" text,
    "debtorId" text,
    "userId" text,
    "templateId" text,
    "contactEmail" text NOT NULL,
    "contactName" text,
    channel text NOT NULL,
    recipient text NOT NULL,
    subject text,
    content text NOT NULL,
    "contentPreview" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    provider text,
    "providerMessageId" text,
    "providerData" jsonb,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "openedAt" timestamp(3) without time zone,
    "clickedAt" timestamp(3) without time zone,
    "scheduledAt" timestamp(3) without time zone,
    error text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.message_logs OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "registrationNumber" text,
    "taxId" text,
    "primaryContact" text,
    "contactEmail" text,
    "contactPhone" text,
    address text,
    "clientType" text,
    "billingEmail" text,
    "billingPhone" text,
    "emailVerifiedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "reviewNotes" text,
    "stripeCustomerId" text,
    "stripePaymentMethodId" text,
    "suspendedAt" timestamp(3) without time zone,
    "suspendedBy" text,
    "termsAcceptedAt" timestamp(3) without time zone,
    "verificationStatus" text DEFAULT 'PENDING_EMAIL'::text NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedBy" text,
    website text
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: permission_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permission_roles (
    id text NOT NULL,
    role text NOT NULL,
    "organizationId" text,
    description text,
    permissions jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.permission_roles OWNER TO postgres;

--
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.templates (
    id text NOT NULL,
    name text NOT NULL,
    channel text NOT NULL,
    subject text,
    content text NOT NULL,
    category text DEFAULT 'GENERAL'::text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.templates OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    password text,
    name text,
    role text DEFAULT 'AGENT'::text NOT NULL,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLogin" timestamp(3) without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: Action; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Action" (id, type, description, priority, status, "assignedToId", "debtorId", "debtId", "dueDate", "completedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditLog" (id, "userId", action, details, "ipAddress", "createdAt") FROM stdin;
\.


--
-- Data for Name: Debt; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Debt" (id, amount, currency, description, "dueDate", status, "debtorId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Debtor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Debtor" (id, "firstName", "lastName", phone, email, address, city, country, "organizationId", "assignedToId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Document" (id, "fileName", "filePath", "fileType", "fileSize", "debtorId", "uploadedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: Interaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Interaction" (id, type, channel, subject, content, direction, "debtorId", "userId", "createdAt") FROM stdin;
\.


--
-- Data for Name: JobQueue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."JobQueue" (id, type, status, payload, result, error, "lockedAt", "processedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Organization" (id, name, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ServiceStatus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServiceStatus" (id, "organizationId", "serviceName", status, "statusMessage", "lastCheck", "responseTime") FROM stdin;
99be8da7-9a8c-4226-af74-c210990c9cb2	org1	dashboard	online	\N	2026-08-25 10:14:54.516	323
b5feb62a-6444-4388-a6aa-0813e73e434f	org1	api	online	\N	2026-08-25 10:14:54.528	233
16c50bc1-0de5-40d9-aecf-8a6e92461aeb	org1	database	online	\N	2026-08-25 10:14:54.531	3
f2968124-4107-44a1-95f6-7642305ce84e	org1	connectors	degraded	No connectors configured	2026-08-25 10:14:54.537	266
7bd061b0-072a-4504-a1a7-c93e2855ca3d	org1	jobs	degraded	No jobs run in last 24 hours	2026-08-25 10:14:54.54	275
\.


--
-- Data for Name: StatusHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."StatusHistory" (id, "organizationId", "serviceName", status, "responseTime", "recordedAt") FROM stdin;
a11aea13-2b0f-4735-8843-42f836678e6a	org1	dashboard	online	745	2026-08-24 21:34:49.962
849c968e-86e1-47bf-b728-8b4c4078383d	org1	api	online	580	2026-08-24 21:34:49.966
16b14fd6-ba24-4c16-a9ae-31981f6a054b	org1	database	online	9	2026-08-24 21:34:49.968
61c0b7b4-0569-48b4-a22e-fc6f99dde94e	org1	connectors	offline	587	2026-08-24 21:34:49.971
f4fe252c-0d14-4396-a720-fdb07bbe6a83	org1	jobs	degraded	593	2026-08-24 21:34:49.973
a8bd2602-1ea5-4d9b-8276-7f252e541eee	org1	dashboard	online	24	2026-08-24 21:40:49.561
f4d3c3d8-3f89-4728-beca-98c0e87a4c05	org1	api	online	39	2026-08-24 21:40:49.564
44043137-3844-49e0-8df4-008ea4bbecaf	org1	database	online	2	2026-08-24 21:40:49.567
920dbac4-83be-4d34-a053-ae9ee5f40286	org1	connectors	offline	89	2026-08-24 21:40:49.569
5b83b660-171b-4f9e-a0d2-840b034696be	org1	jobs	degraded	112	2026-08-24 21:40:49.572
d3e66dd9-ea3f-4c63-926c-84fc82530db9	org1	dashboard	online	230	2026-08-24 21:46:13.748
ea506dcc-a7a3-4f48-83b2-91eced9e8620	org1	api	online	189	2026-08-24 21:46:13.754
4b76de4e-4ca4-4663-b9d8-1e5a0b5c91a8	org1	database	online	4	2026-08-24 21:46:13.756
c3ea58cc-fec3-4925-82d1-41b2d306d506	org1	connectors	offline	220	2026-08-24 21:46:13.759
fe5223f9-91e9-46c2-94bc-afe84088f670	org1	jobs	degraded	220	2026-08-24 21:46:13.763
67c2f75c-92c2-485c-ad11-4c8a0180d1ab	org1	dashboard	online	219	2026-08-24 21:51:51.694
2d75a911-ef3e-4ef5-b583-1d0c824e4105	org1	api	online	143	2026-08-24 21:51:51.698
1226b2d6-7729-4f06-9c8c-81b0031ece39	org1	database	online	4	2026-08-24 21:51:51.701
8697b883-6192-4c73-b12d-39a7e3e4ea1a	org1	connectors	degraded	173	2026-08-24 21:51:51.704
25782e64-be7c-4f20-a48c-a50aa10ac14e	org1	jobs	degraded	165	2026-08-24 21:51:51.707
d2bb3442-0330-4101-9b57-bd6762cc4957	org1	dashboard	online	22	2026-08-24 21:57:27.609
abbd371f-b33f-4387-ab41-a7a1666d599f	org1	api	online	155	2026-08-24 21:57:27.612
0bf37ab1-6ca6-4d45-b8da-abfe662f65ca	org1	database	online	1	2026-08-24 21:57:27.614
4e8eb16f-21c6-4914-9f75-65173cc51530	org1	connectors	degraded	175	2026-08-24 21:57:27.616
98686bcf-c129-48cf-8b14-afaa90f23937	org1	jobs	degraded	190	2026-08-24 21:57:27.617
44ad5a65-5187-4b7f-bfa8-a8d02d98ac40	org1	dashboard	online	323	2026-08-25 10:14:54.526
a8fe27c4-c89c-423c-a407-250ca9a5fbbe	org1	api	online	233	2026-08-25 10:14:54.531
3e675070-0bfe-4fa5-b666-acc4340b33e1	org1	database	online	3	2026-08-25 10:14:54.535
538d2dd5-8dcc-4fb8-8792-9a018fdce7b2	org1	connectors	degraded	266	2026-08-25 10:14:54.54
b12dc06e-2ea7-4df0-b676-e2701fca4bc7	org1	jobs	degraded	275	2026-08-25 10:14:54.545
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, "passwordHash", name, role, "organizationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.actions (id, "debtorId", "assignedTo", type, priority, status, description, "dueDate", "completedAt", "createdAt", "updatedAt", "triggerEmail", "emailTemplateId", "emailDelayHours", "messageLogId", "triggerSms", "smsTemplateId", "smsDelayHours") FROM stdin;
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, "organizationId", "userId", action, "entityType", "entityId", details, "ipAddress", "userAgent", "createdAt") FROM stdin;
cmt72tons000lo83wurotgxcm	org1	user1	UPLOAD	DEBTOR	\N	{"total": 10, "errors": 0, "created": 10}	\N	\N	2026-08-24 10:11:45.305
cmt7395tf000210j3mu1ncyiy	org1	user1	CREATE	USER	cmt7395t1000010j3o883tgbj	{"name": "Musk", "role": "AGENT", "email": "agaent3@gorka.click"}	\N	\N	2026-08-24 10:23:47.379
cmt74cz4x0003mr2oboxdnbev	org1	user1	CREATE	CALENDAR_EVENT	cmt74cz4k0001mr2ox9wnilnw	{"title": "birthday", "eventType": "MANUAL"}	\N	\N	2026-08-24 10:54:44.961
cmt8h2bla0003c4swupmjh3ox	cmt8h2bkw0000c4swuooiiu0d	cmt8h2bkx0001c4swzckqnulo	REGISTER	ORGANIZATION	cmt8h2bkw0000c4swuooiiu0d	{"companyName": "Test Agency", "contactEmail": "john@test.com"}	\N	\N	2026-08-25 09:38:09.07
cmt8ha51h0003c4yszvzwur00	cmt8ha5150000c4ys96brjqet	cmt8ha5150001c4ys227zqrrb	REGISTER	ORGANIZATION	cmt8ha5150000c4ys96brjqet	{"companyName": "Verify Test", "contactEmail": "jane@test.com"}	\N	\N	2026-08-25 09:44:13.829
cmt8hbq3z0001c44wje7bj3av	cmt8ha5150000c4ys96brjqet	cmt8ha5150001c4ys227zqrrb	EMAIL_VERIFIED	ORGANIZATION	cmt8ha5150000c4ys96brjqet	{"email": "jane@test.com", "verificationStatus": "PENDING_REVIEW"}	\N	\N	2026-08-25 09:45:27.791
cmt8hlp2h0003c4ewi6q0pf2i	cmt8hlp100000c4ewiy24iehc	cmt8hlp100001c4ewg5gtu7ah	REGISTER	ORGANIZATION	cmt8hlp100000c4ewiy24iehc	{"companyName": "Test Client", "contactEmail": "test@client.com"}	\N	\N	2026-08-25 09:53:13.001
cmt8hm5rg0005c4ewete6ms0g	cmt8hlp100000c4ewiy24iehc	cmt8hlp100001c4ewg5gtu7ah	EMAIL_VERIFIED	ORGANIZATION	cmt8hlp100000c4ewiy24iehc	{"email": "test@client.com", "verificationStatus": "PENDING_REVIEW"}	\N	\N	2026-08-25 09:53:34.636
cmt8i9ilf0001c4aon1v9tsn0	cmt8hlp100000c4ewiy24iehc	\N	UPDATED	ORGANIZATION	cmt8hlp100000c4ewiy24iehc	{"performedBy": "system", "updatedFields": ["name", "website"]}	\N	\N	2026-08-25 10:11:44.355
cmt8i9z0g0003c4ao0l0xolqi	cmt8hlp100000c4ewiy24iehc	\N	SUSPENDED	ORGANIZATION	cmt8hlp100000c4ewiy24iehc	{"reason": "Violation of terms", "newStatus": "SUSPENDED", "performedBy": "system", "previousStatus": "ACTIVE"}	\N	\N	2026-08-25 10:12:05.633
cmt8iaeeh0005c4ao9l2it13x	cmt8hlp100000c4ewiy24iehc	\N	REINSTATED	ORGANIZATION	cmt8hlp100000c4ewiy24iehc	{"notes": "Issue resolved", "newStatus": "ACTIVE", "performedBy": "system", "previousStatus": "SUSPENDED"}	\N	\N	2026-08-25 10:12:25.577
cmt8ib2st0009c4aoi35ga10x	cmt8ib2qm0006c4aonljjr0mn	cmt8ib2qm0007c4aoss76o5ed	REGISTER	ORGANIZATION	cmt8ib2qm0006c4aonljjr0mn	{"companyName": "Reject Test", "contactEmail": "reject@test.com"}	\N	\N	2026-08-25 10:12:57.197
cmt8ibj0j000bc4aoha2okolh	cmt8ib2qm0006c4aonljjr0mn	cmt8ib2qm0007c4aoss76o5ed	EMAIL_VERIFIED	ORGANIZATION	cmt8ib2qm0006c4aonljjr0mn	{"email": "reject@test.com", "verificationStatus": "PENDING_REVIEW"}	\N	\N	2026-08-25 10:13:18.212
cmt8ibwkt000dc4ao6rq3ai1d	cmt8ib2qm0006c4aonljjr0mn	\N	REJECTED	ORGANIZATION	cmt8ib2qm0006c4aonljjr0mn	{"reason": "Invalid business information", "newStatus": "REJECTED", "performedBy": "system", "previousStatus": "PENDING_REVIEW"}	\N	\N	2026-08-25 10:13:35.789
cmt8icf15000hc4aofnde34tk	cmt8icf10000ec4ao944ka150	cmt8icf10000fc4aozyfir83n	REGISTER	ORGANIZATION	cmt8icf10000ec4ao944ka150	{"companyName": "Resend Test", "contactEmail": "resend@test.com"}	\N	\N	2026-08-25 10:13:59.705
cmt8icu5q000jc4aon21wdext	cmt8icf10000ec4ao944ka150	cmt8icf10000fc4aozyfir83n	VERIFICATION_RESENT	ORGANIZATION	cmt8icf10000ec4ao944ka150	{"email": "resend@test.com"}	\N	\N	2026-08-25 10:14:19.31
cmt8lw1df0003c4yw32drblt3	cmt8lw1d50000c4ywfhcffhd8	cmt8lw1d50001c4ywbgsatmr5	REGISTER	ORGANIZATION	cmt8lw1d50000c4ywfhcffhd8	{"companyName": "Agency Alfa", "contactEmail": "trum@example.com"}	\N	\N	2026-08-25 11:53:13.971
cmt8mdja30005c4ywad9fzwpv	cmt8lw1d50000c4ywfhcffhd8	\N	UPDATED	ORGANIZATION	cmt8lw1d50000c4ywfhcffhd8	{"performedBy": "system", "updatedFields": ["name", "clientType", "registrationNumber", "taxId", "primaryContact", "contactEmail", "contactPhone", "address", "website", "billingEmail", "billingPhone"]}	\N	\N	2026-08-25 12:06:50.331
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calendar_events (id, "organizationId", "debtorId", title, description, "startDate", "endDate", type, status, source, "sourceId", "sourceDate", "allDay", "eventType", "createdBy", "createdAt", "updatedAt") FROM stdin;
cmt74cz4k0001mr2ox9wnilnw	org1	\N	birthday	drinking	2026-08-25 02:54:00	2026-08-25 03:54:00	TASK	PENDING	\N	\N	\N	t	MANUAL	user1	2026-08-24 10:54:44.947	2026-08-24 10:54:44.947
\.


--
-- Data for Name: connectors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.connectors (id, "organizationId", name, type, provider, status, config, credentials, "createdAt", "updatedAt", description, category, "isDefault", "isEnabled", acknowledged, "lastTestedAt") FROM stdin;
37ef7821-53ef-4b97-a19b-5a1d26c93d3e	org1	Push	COMMUNICATION	Push	CONNECTED	95608150a731729e7ba704b2506bd5ac:9330d4d50d97c6b3947aba0dad04c4db:ae760908e7c148b17fa862959bd2a00f0e3caad39a0d	ddba9d75e1aac6ed90e364271e6ad04b:99bc22114069f86c61e4c8e244e94c94:e4f70a289c237fa9f74992e2eaa07a	2026-08-24 19:01:31.731	2026-08-24 12:07:26.211	\N	\N	f	f	t	\N
ce52611e-11b1-45a0-b931-2645a360d3b3	org1	SMS	COMMUNICATION	MoceanSMS	CONNECTED	94441306f48f6935c3ae27695ac8d7a2:ea3e866090d8eeed8d34a4bb83582ed4:35e22044f7184b1823982c9d3e3c2b4765b3293d4f46	1aab138b51bc55a7b69ed6887c4379a4:f14cd2883612f7909907120011ff118c:23d1084a0836cc94eb2737d49ec97f	2026-08-24 19:01:30.377	2026-08-24 12:07:42.488	\N	\N	f	f	t	\N
6c1ebec7-d4bb-4664-8944-a279dea2acc5	org1	Email	COMMUNICATION	Resend	CONNECTED	795d21dc208a852cb3b74d8d9d61602a:a6c6455b630746a72f526f6031cc41bd:fd6e6a323089941e86fdf8f360e25d3b9251e61dc4aa	3aab881d170b7f5a875bc8e1e5471ed5:4901a62dd90059118c8639a6835f49a1:a108c2bc5e49c89c4a89a8cdf80b00a4	2026-08-24 19:01:30.36	2026-08-24 13:11:11.077	\N	\N	f	f	t	\N
aba693f9-cb51-4151-abe4-0496b13936af	org1	Voice	COMMUNICATION	Twilio	CONNECTED	abdeb36ec0e394f05afd881b2e990cff:96f4296ad3dd03e1afe86ecfa6a9ea98:d7508d7998bffdecc2efd914e909881a439c7218f8d3	edb8e7b6188258123340a9554ba5c59d:d4aba0f879e0c33a0cd27695cf664a62:691402d522d57254b9e42a31744de3b608	2026-08-24 19:01:30.389	2026-08-24 13:11:44.593	\N	\N	f	f	t	\N
\.


--
-- Data for Name: debtors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.debtors (id, "organizationId", name, email, phone, address, "totalDebt", "daysOverdue", status, "createdAt", "updatedAt", "nextFollowUpDate", "nextPaymentDate") FROM stdin;
cmt72tomt0001o83w0uqdqar6	org1	Alice Williams	alice.williams@example.com	+4449876543	\N	25000	\N	ACTIVE	2026-08-24 10:11:45.268	2026-08-24 10:11:45.268	\N	\N
cmt72ton50003o83wyosa5e61	org1	Bob Johnson	bob.johnson@example.com	+5551234567	\N	15000	\N	ACTIVE	2026-08-24 10:11:45.281	2026-08-24 10:11:45.281	\N	\N
cmt72ton80005o83we4d98mha	org1	Carol Davis	carol.davis@example.com	+4449876544	\N	42000	\N	ACTIVE	2026-08-24 10:11:45.284	2026-08-24 10:11:45.284	\N	\N
cmt72tonb0007o83wedmwpgbk	org1	David Miller	david.miller@example.com	+4449876545	\N	5000	\N	ACTIVE	2026-08-24 10:11:45.287	2026-08-24 10:11:45.287	\N	\N
cmt72tond0009o83wrcumlj0o	org1	Emma Wilson	emma.wilson@example.com	+4449876546	\N	38000	\N	ACTIVE	2026-08-24 10:11:45.29	2026-08-24 10:11:45.29	\N	\N
cmt72tong000bo83w9r5pn43p	org1	Frank Moore	frank.moore@example.com	+4449876547	\N	12000	\N	ACTIVE	2026-08-24 10:11:45.292	2026-08-24 10:11:45.292	\N	\N
cmt72tonj000do83wqmtxwo2c	org1	Grace Taylor	grace.taylor@example.com	+4449876548	\N	55000	\N	ACTIVE	2026-08-24 10:11:45.295	2026-08-24 10:11:45.295	\N	\N
cmt72tonl000fo83w0ritjep3	org1	Henry Anderson	henry.anderson@example.com	+4449876549	\N	28000	\N	ACTIVE	2026-08-24 10:11:45.297	2026-08-24 10:11:45.297	\N	\N
cmt72tonn000ho83wbv3j5anf	org1	Irene Thomas	irene.thomas@example.com	+4449876550	\N	8000	\N	ACTIVE	2026-08-24 10:11:45.3	2026-08-24 10:11:45.3	\N	\N
cmt72tonp000jo83w4q2kxf0y	org1	Jack Jackson	jack.jackson@example.com	+4449876551	\N	45000	\N	ACTIVE	2026-08-24 10:11:45.302	2026-08-24 10:11:45.302	\N	\N
\.


--
-- Data for Name: debts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.debts (id, "debtorId", amount, currency, "dueDate", status, description, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: external_enrichments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.external_enrichments (id, "connectorId", "debtorId", "organizationId", "externalScore", "riskLevel", "externalStatus", "retrievedAt", "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: message_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_events (id, "messageLogId", event, data, "timestamp", "createdAt") FROM stdin;
\.


--
-- Data for Name: message_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_logs (id, "jobId", "debtorId", "userId", "templateId", "contactEmail", "contactName", channel, recipient, subject, content, "contentPreview", status, provider, "providerMessageId", "providerData", "sentAt", "deliveredAt", "openedAt", "clickedAt", "scheduledAt", error, metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, timezone, "createdAt", "updatedAt", "registrationNumber", "taxId", "primaryContact", "contactEmail", "contactPhone", address, "clientType", "billingEmail", "billingPhone", "emailVerifiedAt", "rejectedAt", "reviewNotes", "stripeCustomerId", "stripePaymentMethodId", "suspendedAt", "suspendedBy", "termsAcceptedAt", "verificationStatus", "verifiedAt", "verifiedBy", website) FROM stdin;
org1	GORKA Demo	UTC	2026-08-24 16:37:37.756	2026-08-24 16:37:37.756	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	PENDING_EMAIL	\N	\N	\N
cmt8h2bkw0000c4swuooiiu0d	Test Agency	UTC	2026-08-25 09:38:09.057	2026-08-25 09:38:09.057	\N	\N	John Doe	john@test.com	+1234567890	\N	AGENCY	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-25 09:38:09.052	PENDING_EMAIL	\N	\N	\N
cmt8ha5150000c4ys96brjqet	Verify Test	UTC	2026-08-25 09:44:13.817	2026-08-25 09:45:27.777	\N	\N	Jane Doe	jane@test.com	+1234567890	\N	AGENCY	\N	\N	2026-08-25 09:45:27.765	\N	\N	\N	\N	\N	\N	2026-08-25 09:44:13.813	PENDING_REVIEW	\N	\N	\N
cmt8hlp100000c4ewiy24iehc	Updated Client Name	UTC	2026-08-25 09:53:12.948	2026-08-25 10:12:25.57	\N	\N	Test User	test@client.com	+1234567890	\N	AGENCY	\N	\N	2026-08-25 09:53:34.63	\N	Issue resolved	\N	\N	\N	\N	2026-08-25 09:53:12.945	ACTIVE	2026-08-25 09:54:48.485	system	https://example.com
cmt8ib2qm0006c4aonljjr0mn	Reject Test	UTC	2026-08-25 10:12:57.119	2026-08-25 10:13:35.782	\N	\N	Reject User	reject@test.com	+1234567890	\N	AGENCY	\N	\N	2026-08-25 10:13:18.202	2026-08-25 10:13:35.78	Invalid business information	\N	\N	\N	\N	2026-08-25 10:12:57.116	REJECTED	\N	\N	\N
cmt8icf10000ec4ao944ka150	Resend Test	UTC	2026-08-25 10:13:59.7	2026-08-25 10:13:59.7	\N	\N	Resend User	resend@test.com	+1234567890	\N	AGENCY	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-25 10:13:59.697	PENDING_EMAIL	\N	\N	\N
cmt8lw1d50000c4ywfhcffhd8	Agency Alfa	UTC	2026-08-25 11:53:13.961	2026-08-25 12:06:50.308	1234567	1234567	Trump Ha Ha 	trum@example.com	1234567890	123 nan	AGENCY	www@text.com	12345678	\N	\N	\N	\N	\N	\N	\N	2026-08-25 11:53:13.959	PENDING_EMAIL	\N	\N	
\.


--
-- Data for Name: permission_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permission_roles (id, role, "organizationId", description, permissions, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.templates (id, name, channel, subject, content, category, description, "isActive", version, "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, "passwordHash", password, name, role, "organizationId", "createdAt", "updatedAt", "isActive", "lastLogin") FROM stdin;
cmt7395t1000010j3o883tgbj	agaent3@gorka.click	$2a$10$krU33vpZFeAxzuUZCe8OHOdXo6/DZrcGz/tunaSypZ1F9lTLNLHES	$2a$10$krU33vpZFeAxzuUZCe8OHOdXo6/DZrcGz/tunaSypZ1F9lTLNLHES	Musk	AGENT	org1	2026-08-24 10:23:47.366	2026-08-24 10:23:47.366	t	\N
user1	admin@gorka.click	$2a$10$uS6tZEfpErI4pODjS.miMuahqXUcApSsm5KzQ53Q8asHjMXstv7L.	\N	Admin	ADMIN	org1	2026-08-24 16:49:54.949	2026-08-24 13:01:14.512	t	2026-08-24 13:01:14.51
cmt8h2bkx0001c4swzckqnulo	john@test.com	$2a$10$EVgiG7ja0QNupUF..BcoHuYejUpDo4Ih.9Zt/iKKZywRO7ViTerw.	\N	John Doe	AGENT	cmt8h2bkw0000c4swuooiiu0d	2026-08-25 09:38:09.057	2026-08-25 09:38:09.057	t	\N
cmt8ha5150001c4ys227zqrrb	jane@test.com	$2a$10$mOkW9ONeo1oC/nCh2KfwJudFjRZAZTZFys6.maYOILDYhXlmZ9EP.	\N	Jane Doe	AGENT	cmt8ha5150000c4ys96brjqet	2026-08-25 09:44:13.817	2026-08-25 09:44:13.817	t	\N
cmt8hlp100001c4ewg5gtu7ah	test@client.com	$2a$10$4a/ZBEdx4j5YlhSaS66.8O9Ks3rBUvTbUSXwV8.Z63TrN5UjZN/nS	\N	Test User	AGENT	cmt8hlp100000c4ewiy24iehc	2026-08-25 09:53:12.948	2026-08-25 09:53:12.948	t	\N
cmt8ib2qm0007c4aoss76o5ed	reject@test.com	$2a$10$DJEKepumP9yZXnRlKpzI2ub.KYoys/wNJwq6BP7R.xJz9CYz9MFnW	\N	Reject User	AGENT	cmt8ib2qm0006c4aonljjr0mn	2026-08-25 10:12:57.119	2026-08-25 10:12:57.119	t	\N
cmt8icf10000fc4aozyfir83n	resend@test.com	$2a$10$.N7KIfvb7rXgHXJ1pEpmHuzJQwo9u7jI6814NHGIXPG9qztTCxzDi	\N	Resend User	AGENT	cmt8icf10000ec4ao944ka150	2026-08-25 10:13:59.7	2026-08-25 10:13:59.7	t	\N
cmt8lw1d50001c4ywbgsatmr5	trum@example.com	$2a$10$4Nfe/ZylzaqUGkZW80dmOu425B7SVjjkiRP/FWoj0QBW9H8QIvnMG	\N	Trump	AGENT	cmt8lw1d50000c4ywfhcffhd8	2026-08-25 11:53:13.961	2026-08-25 11:53:13.961	t	\N
\.


--
-- Name: Action Action_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Action"
    ADD CONSTRAINT "Action_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Debt Debt_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Debt"
    ADD CONSTRAINT "Debt_pkey" PRIMARY KEY (id);


--
-- Name: Debtor Debtor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Debtor"
    ADD CONSTRAINT "Debtor_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: Interaction Interaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Interaction"
    ADD CONSTRAINT "Interaction_pkey" PRIMARY KEY (id);


--
-- Name: JobQueue JobQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobQueue"
    ADD CONSTRAINT "JobQueue_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: ServiceStatus ServiceStatus_organizationId_serviceName_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceStatus"
    ADD CONSTRAINT "ServiceStatus_organizationId_serviceName_key" UNIQUE ("organizationId", "serviceName");


--
-- Name: ServiceStatus ServiceStatus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceStatus"
    ADD CONSTRAINT "ServiceStatus_pkey" PRIMARY KEY (id);


--
-- Name: StatusHistory StatusHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StatusHistory"
    ADD CONSTRAINT "StatusHistory_pkey" PRIMARY KEY (id);


--
-- Name: User User_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_email_key" UNIQUE (email);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


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
-- Name: calendar_events calendar_events_organizationId_eventType_debtorId_sourceDat_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_organizationId_eventType_debtorId_sourceDat_key" UNIQUE ("organizationId", "eventType", "debtorId", "sourceDate");


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: connectors connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (id);


--
-- Name: debtors debtors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_pkey PRIMARY KEY (id);


--
-- Name: debts debts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debts
    ADD CONSTRAINT debts_pkey PRIMARY KEY (id);


--
-- Name: external_enrichments external_enrichments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_enrichments
    ADD CONSTRAINT external_enrichments_pkey PRIMARY KEY (id);


--
-- Name: message_events message_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_events
    ADD CONSTRAINT message_events_pkey PRIMARY KEY (id);


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
-- Name: permission_roles permission_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_roles
    ADD CONSTRAINT permission_roles_pkey PRIMARY KEY (id);


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
-- Name: calendar_events_organizationId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "calendar_events_organizationId_idx" ON public.calendar_events USING btree ("organizationId");


--
-- Name: calendar_events_startDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "calendar_events_startDate_idx" ON public.calendar_events USING btree ("startDate");


--
-- Name: idx_action_assigned_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_action_assigned_status ON public."Action" USING btree ("assignedToId", status);


--
-- Name: idx_jobqueue_status_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobqueue_status_locked ON public."JobQueue" USING btree (status, "lockedAt");


--
-- Name: message_logs_jobId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "message_logs_jobId_key" ON public.message_logs USING btree ("jobId");


--
-- Name: organizations_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON public.organizations USING btree ("stripeCustomerId");


--
-- Name: permission_roles_role_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permission_roles_role_key ON public.permission_roles USING btree (role);


--
-- Name: templates_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX templates_name_key ON public.templates USING btree (name);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: Action Action_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Action"
    ADD CONSTRAINT "Action_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id);


--
-- Name: Action Action_debtId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Action"
    ADD CONSTRAINT "Action_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES public."Debt"(id);


--
-- Name: Action Action_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Action"
    ADD CONSTRAINT "Action_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public."Debtor"(id);


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id);


--
-- Name: Debt Debt_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Debt"
    ADD CONSTRAINT "Debt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public."Debtor"(id);


--
-- Name: Debtor Debtor_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Debtor"
    ADD CONSTRAINT "Debtor_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id);


--
-- Name: Debtor Debtor_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Debtor"
    ADD CONSTRAINT "Debtor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id);


--
-- Name: Document Document_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public."Debtor"(id);


--
-- Name: Document Document_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id);


--
-- Name: Interaction Interaction_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Interaction"
    ADD CONSTRAINT "Interaction_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public."Debtor"(id);


--
-- Name: Interaction Interaction_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Interaction"
    ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id);


--
-- Name: User User_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id);


--
-- Name: actions actions_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT "actions_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: actions actions_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT "actions_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "activity_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: connectors connectors_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT "connectors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: debtors debtors_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT "debtors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: debts debts_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debts
    ADD CONSTRAINT "debts_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: external_enrichments external_enrichments_connectorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_enrichments
    ADD CONSTRAINT "external_enrichments_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES public.connectors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_events message_events_messageLogId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_events
    ADD CONSTRAINT "message_events_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES public.message_logs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_logs message_logs_debtorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT "message_logs_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES public.debtors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: message_logs message_logs_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT "message_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: message_logs message_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT "message_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict tIirfv64Bsjwf67d41vtevzhLKSvjrdvf4dchW3BLom8tpqGgabJVYvMs7AVKHI

