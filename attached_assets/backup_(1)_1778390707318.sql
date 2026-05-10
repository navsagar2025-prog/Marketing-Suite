--
-- PostgreSQL database dump
--

\restrict sO5ee5uyPBLG3Kdrx3tMkJEZ9glbETKcdsfq7Puem3wdcup430rpSTHFgFb6jPJ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ab_test_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ab_test_status AS ENUM (
    'active',
    'closed'
);


ALTER TYPE public.ab_test_status OWNER TO postgres;

--
-- Name: ab_test_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ab_test_type AS ENUM (
    'headline',
    'cta',
    'meta_description',
    'ad_copy'
);


ALTER TYPE public.ab_test_type OWNER TO postgres;

--
-- Name: keyword_intent; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.keyword_intent AS ENUM (
    'informational',
    'commercial',
    'navigational',
    'transactional'
);


ALTER TYPE public.keyword_intent OWNER TO postgres;

--
-- Name: site_audit_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.site_audit_severity AS ENUM (
    'critical',
    'warning',
    'info'
);


ALTER TYPE public.site_audit_severity OWNER TO postgres;

--
-- Name: site_audit_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.site_audit_status AS ENUM (
    'queued',
    'crawling',
    'complete',
    'failed'
);


ALTER TYPE public.site_audit_status OWNER TO postgres;

--
-- Name: staff_plan; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_plan AS ENUM (
    'starter',
    'growth',
    'agency'
);


ALTER TYPE public.staff_plan OWNER TO postgres;

--
-- Name: staff_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_role AS ENUM (
    'admin',
    'staff'
);


ALTER TYPE public.staff_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ab_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ab_tests (
    id integer NOT NULL,
    name text NOT NULL,
    type public.ab_test_type NOT NULL,
    status public.ab_test_status DEFAULT 'active'::public.ab_test_status NOT NULL,
    winner_threshold integer DEFAULT 100 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ab_tests OWNER TO postgres;

--
-- Name: ab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ab_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ab_tests_id_seq OWNER TO postgres;

--
-- Name: ab_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ab_tests_id_seq OWNED BY public.ab_tests.id;


--
-- Name: ab_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ab_variants (
    id integer NOT NULL,
    test_id integer NOT NULL,
    name text NOT NULL,
    content text NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ab_variants OWNER TO postgres;

--
-- Name: ab_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ab_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ab_variants_id_seq OWNER TO postgres;

--
-- Name: ab_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ab_variants_id_seq OWNED BY public.ab_variants.id;


--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_usage (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    year_month text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_usage OWNER TO postgres;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_usage_id_seq OWNER TO postgres;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_usage_id_seq OWNED BY public.ai_usage.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_settings_id_seq OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: backlinks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backlinks (
    id integer NOT NULL,
    website_id integer NOT NULL,
    prospect_url text NOT NULL,
    prospect_domain text NOT NULL,
    contact_email text,
    status text DEFAULT 'not_contacted'::text NOT NULL,
    domain_authority integer,
    type text DEFAULT 'guest_post'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.backlinks OWNER TO postgres;

--
-- Name: backlinks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.backlinks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backlinks_id_seq OWNER TO postgres;

--
-- Name: backlinks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.backlinks_id_seq OWNED BY public.backlinks.id;


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_posts (
    id integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    author text DEFAULT 'Marketing Team'::text NOT NULL,
    seo_title text,
    seo_description text,
    reading_time integer DEFAULT 5 NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    featured_image text,
    featured_in_rss boolean DEFAULT false NOT NULL,
    featured_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.blog_posts OWNER TO postgres;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blog_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blog_posts_id_seq OWNER TO postgres;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blog_posts_id_seq OWNED BY public.blog_posts.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    website_url text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_id_seq OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    website_id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'organic'::text NOT NULL,
    goal text NOT NULL,
    budget numeric(10,2),
    status text DEFAULT 'planning'::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    notes text,
    impressions integer,
    clicks integer,
    conversions integer,
    spend numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    sent_count integer
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.campaigns_id_seq OWNER TO postgres;

--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- Name: chatbot_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatbot_conversations (
    id integer NOT NULL,
    visitor_id text NOT NULL,
    ip text,
    user_agent text,
    page_url text,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chatbot_conversations OWNER TO postgres;

--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chatbot_conversations_id_seq OWNER TO postgres;

--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_conversations_id_seq OWNED BY public.chatbot_conversations.id;


--
-- Name: client_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_reports (
    id integer NOT NULL,
    website_id integer NOT NULL,
    title text NOT NULL,
    date_range_start text NOT NULL,
    date_range_end text NOT NULL,
    sections jsonb NOT NULL,
    snapshot jsonb NOT NULL,
    share_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_reports OWNER TO postgres;

--
-- Name: client_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_reports_id_seq OWNER TO postgres;

--
-- Name: client_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_reports_id_seq OWNED BY public.client_reports.id;


--
-- Name: competitor_analyses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competitor_analyses (
    id integer NOT NULL,
    website_id integer NOT NULL,
    competitor_url text NOT NULL,
    analysis_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.competitor_analyses OWNER TO postgres;

--
-- Name: competitor_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competitor_analyses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competitor_analyses_id_seq OWNER TO postgres;

--
-- Name: competitor_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competitor_analyses_id_seq OWNED BY public.competitor_analyses.id;


--
-- Name: competitor_research_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competitor_research_sessions (
    id integer NOT NULL,
    staff_user_id integer NOT NULL,
    domain text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    cached_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.competitor_research_sessions OWNER TO postgres;

--
-- Name: competitor_research_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competitor_research_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competitor_research_sessions_id_seq OWNER TO postgres;

--
-- Name: competitor_research_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competitor_research_sessions_id_seq OWNED BY public.competitor_research_sessions.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_id integer
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    discount_value integer NOT NULL,
    applies_to text DEFAULT 'all'::text NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.coupons OWNER TO postgres;

--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coupons_id_seq OWNER TO postgres;

--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    website_id integer,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_templates OWNER TO postgres;

--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_templates_id_seq OWNER TO postgres;

--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: ga4_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ga4_cache (
    id integer NOT NULL,
    website_id integer NOT NULL,
    cache_key text NOT NULL,
    data jsonb NOT NULL,
    cached_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ga4_cache OWNER TO postgres;

--
-- Name: ga4_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ga4_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ga4_cache_id_seq OWNER TO postgres;

--
-- Name: ga4_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ga4_cache_id_seq OWNED BY public.ga4_cache.id;


--
-- Name: gallery_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gallery_images (
    id integer NOT NULL,
    gallery_type text NOT NULL,
    url text NOT NULL,
    caption text,
    category_tag text,
    location_tag text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seo_title text,
    seo_description text
);


ALTER TABLE public.gallery_images OWNER TO postgres;

--
-- Name: gallery_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gallery_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gallery_images_id_seq OWNER TO postgres;

--
-- Name: gallery_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gallery_images_id_seq OWNED BY public.gallery_images.id;


--
-- Name: gsc_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gsc_cache (
    id integer NOT NULL,
    website_id integer NOT NULL,
    date_range text NOT NULL,
    data jsonb NOT NULL,
    cached_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gsc_cache OWNER TO postgres;

--
-- Name: gsc_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gsc_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gsc_cache_id_seq OWNER TO postgres;

--
-- Name: gsc_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gsc_cache_id_seq OWNED BY public.gsc_cache.id;


--
-- Name: health_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.health_snapshots (
    id integer NOT NULL,
    cpu_pct double precision,
    mem_used_bytes bigint,
    mem_total_bytes bigint,
    disk_used_bytes bigint,
    disk_total_bytes bigint,
    db_size_bytes bigint,
    page_views_24h integer,
    active_visitors integer,
    extra jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.health_snapshots OWNER TO postgres;

--
-- Name: health_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.health_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.health_snapshots_id_seq OWNER TO postgres;

--
-- Name: health_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.health_snapshots_id_seq OWNED BY public.health_snapshots.id;


--
-- Name: ip_allowlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_allowlist (
    id integer NOT NULL,
    ip text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ip_allowlist OWNER TO postgres;

--
-- Name: ip_allowlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ip_allowlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ip_allowlist_id_seq OWNER TO postgres;

--
-- Name: ip_allowlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ip_allowlist_id_seq OWNED BY public.ip_allowlist.id;


--
-- Name: ip_rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_rate_limits (
    id integer NOT NULL,
    ip text NOT NULL,
    feature text DEFAULT 'public_audit'::text NOT NULL,
    url text,
    date text NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    last_request_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ip_rate_limits OWNER TO postgres;

--
-- Name: ip_rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ip_rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ip_rate_limits_id_seq OWNER TO postgres;

--
-- Name: ip_rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ip_rate_limits_id_seq OWNED BY public.ip_rate_limits.id;


--
-- Name: kb_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kb_articles (
    id integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    subcategory text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    helpful integer DEFAULT 0 NOT NULL,
    not_helpful integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kb_articles OWNER TO postgres;

--
-- Name: kb_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kb_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kb_articles_id_seq OWNER TO postgres;

--
-- Name: kb_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kb_articles_id_seq OWNED BY public.kb_articles.id;


--
-- Name: keyword_rank_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keyword_rank_history (
    id integer NOT NULL,
    keyword_id integer NOT NULL,
    rank integer,
    recorded_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.keyword_rank_history OWNER TO postgres;

--
-- Name: keyword_rank_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.keyword_rank_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.keyword_rank_history_id_seq OWNER TO postgres;

--
-- Name: keyword_rank_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.keyword_rank_history_id_seq OWNED BY public.keyword_rank_history.id;


--
-- Name: keyword_research_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keyword_research_sessions (
    id integer NOT NULL,
    staff_user_id integer NOT NULL,
    website_id integer,
    seed_input text NOT NULL,
    suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.keyword_research_sessions OWNER TO postgres;

--
-- Name: keyword_research_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.keyword_research_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.keyword_research_sessions_id_seq OWNER TO postgres;

--
-- Name: keyword_research_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.keyword_research_sessions_id_seq OWNED BY public.keyword_research_sessions.id;


--
-- Name: keywords; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keywords (
    id integer NOT NULL,
    website_id integer NOT NULL,
    keyword text NOT NULL,
    current_rank integer,
    search_volume integer,
    difficulty integer,
    status text DEFAULT 'tracking'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cluster text,
    intent public.keyword_intent
);


ALTER TABLE public.keywords OWNER TO postgres;

--
-- Name: keywords_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.keywords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.keywords_id_seq OWNER TO postgres;

--
-- Name: keywords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.keywords_id_seq OWNED BY public.keywords.id;


--
-- Name: lead_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_forms (
    id integer NOT NULL,
    website_id integer NOT NULL,
    name text NOT NULL,
    fields_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    submission_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead_forms OWNER TO postgres;

--
-- Name: lead_forms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lead_forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_forms_id_seq OWNER TO postgres;

--
-- Name: lead_forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lead_forms_id_seq OWNED BY public.lead_forms.id;


--
-- Name: lead_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_notes (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    staff_user_id integer,
    author_name text NOT NULL,
    body text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead_notes OWNER TO postgres;

--
-- Name: lead_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lead_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_notes_id_seq OWNER TO postgres;

--
-- Name: lead_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lead_notes_id_seq OWNED BY public.lead_notes.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    website_id integer NOT NULL,
    campaign_id integer,
    name text NOT NULL,
    email text,
    phone text,
    source text DEFAULT 'organic'::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    notes text,
    value numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    score integer,
    score_breakdown jsonb,
    company text
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leads_id_seq OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: link_suggestions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.link_suggestions (
    id integer NOT NULL,
    website_id integer NOT NULL,
    source_page text NOT NULL,
    target_page text NOT NULL,
    anchor_text text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.link_suggestions OWNER TO postgres;

--
-- Name: link_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.link_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.link_suggestions_id_seq OWNER TO postgres;

--
-- Name: link_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.link_suggestions_id_seq OWNED BY public.link_suggestions.id;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    ip text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_until timestamp with time zone
);


ALTER TABLE public.login_attempts OWNER TO postgres;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_attempts_id_seq OWNER TO postgres;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_assets (
    id integer NOT NULL,
    website_id integer,
    campaign_id integer,
    url text NOT NULL,
    type text NOT NULL,
    prompt text NOT NULL,
    aspect_ratio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_assets OWNER TO postgres;

--
-- Name: media_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.media_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_assets_id_seq OWNER TO postgres;

--
-- Name: media_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.media_assets_id_seq OWNED BY public.media_assets.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_tokens (
    id integer NOT NULL,
    staff_user_id integer NOT NULL,
    website_id integer,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    scopes text,
    gsc_property_url text,
    google_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ga4_property_id text
);


ALTER TABLE public.oauth_tokens OWNER TO postgres;

--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.oauth_tokens_id_seq OWNER TO postgres;

--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.oauth_tokens_id_seq OWNED BY public.oauth_tokens.id;


--
-- Name: outreach_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outreach_contacts (
    id integer NOT NULL,
    name text NOT NULL,
    domain text NOT NULL,
    email text,
    type text DEFAULT 'link_request'::text NOT NULL,
    status text DEFAULT 'not_sent'::text NOT NULL,
    date_sent date,
    follow_up_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.outreach_contacts OWNER TO postgres;

--
-- Name: outreach_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.outreach_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outreach_contacts_id_seq OWNER TO postgres;

--
-- Name: outreach_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.outreach_contacts_id_seq OWNED BY public.outreach_contacts.id;


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.page_views (
    id integer NOT NULL,
    path text NOT NULL,
    referrer text,
    ip_hash text,
    user_agent text,
    visitor_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.page_views OWNER TO postgres;

--
-- Name: page_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.page_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.page_views_id_seq OWNER TO postgres;

--
-- Name: page_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.page_views_id_seq OWNED BY public.page_views.id;


--
-- Name: pagespeed_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagespeed_results (
    id integer NOT NULL,
    website_id integer NOT NULL,
    strategy text NOT NULL,
    performance_score integer,
    accessibility_score integer,
    best_practices_score integer,
    seo_score integer,
    lcp_ms real,
    fcp_ms real,
    cls_score real,
    inp_ms real,
    ttfb_ms real,
    speed_index_ms real,
    error text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pagespeed_results OWNER TO postgres;

--
-- Name: pagespeed_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagespeed_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagespeed_results_id_seq OWNER TO postgres;

--
-- Name: pagespeed_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagespeed_results_id_seq OWNED BY public.pagespeed_results.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    url text NOT NULL,
    alt text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_images_id_seq OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    short_description text,
    price text,
    brand_id integer,
    category text DEFAULT 'General'::text NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    hero_image text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    seo_title text,
    seo_description text
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    image_url text,
    cta_label text,
    cta_url text,
    cta_color text DEFAULT '#2563eb'::text NOT NULL,
    audience text DEFAULT 'all'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.promotions OWNER TO postgres;

--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promotions_id_seq OWNER TO postgres;

--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_events (
    id integer NOT NULL,
    user_id integer,
    actor_id integer,
    action text NOT NULL,
    target text,
    ip text,
    user_agent text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.security_events OWNER TO postgres;

--
-- Name: security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.security_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_events_id_seq OWNER TO postgres;

--
-- Name: security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.security_events_id_seq OWNED BY public.security_events.id;


--
-- Name: seo_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seo_audits (
    id integer NOT NULL,
    website_id integer NOT NULL,
    score integer NOT NULL,
    issues_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    crawled_data jsonb,
    crawled_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seo_audits OWNER TO postgres;

--
-- Name: seo_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seo_audits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seo_audits_id_seq OWNER TO postgres;

--
-- Name: seo_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seo_audits_id_seq OWNED BY public.seo_audits.id;


--
-- Name: sequence_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sequence_enrollments (
    id integer NOT NULL,
    sequence_id integer NOT NULL,
    lead_id integer NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    next_send_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sequence_enrollments OWNER TO postgres;

--
-- Name: sequence_enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sequence_enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sequence_enrollments_id_seq OWNER TO postgres;

--
-- Name: sequence_enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sequence_enrollments_id_seq OWNED BY public.sequence_enrollments.id;


--
-- Name: sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sequences (
    id integer NOT NULL,
    name text NOT NULL,
    trigger jsonb NOT NULL,
    steps_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sequences OWNER TO postgres;

--
-- Name: sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sequences_id_seq OWNER TO postgres;

--
-- Name: sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sequences_id_seq OWNED BY public.sequences.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    jti text NOT NULL,
    device text,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: site_audit_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_audit_issues (
    id integer NOT NULL,
    site_audit_id integer NOT NULL,
    page_url text NOT NULL,
    issue_type text NOT NULL,
    severity public.site_audit_severity NOT NULL,
    description text NOT NULL,
    recommendation text NOT NULL
);


ALTER TABLE public.site_audit_issues OWNER TO postgres;

--
-- Name: site_audit_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.site_audit_issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_audit_issues_id_seq OWNER TO postgres;

--
-- Name: site_audit_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.site_audit_issues_id_seq OWNED BY public.site_audit_issues.id;


--
-- Name: site_audit_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_audit_pages (
    id integer NOT NULL,
    site_audit_id integer NOT NULL,
    url text NOT NULL,
    status_code integer,
    title text,
    meta_description text,
    h1 text,
    word_count integer,
    response_time_ms integer,
    issue_count integer DEFAULT 0 NOT NULL,
    score integer,
    crawled_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.site_audit_pages OWNER TO postgres;

--
-- Name: site_audit_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.site_audit_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_audit_pages_id_seq OWNER TO postgres;

--
-- Name: site_audit_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.site_audit_pages_id_seq OWNED BY public.site_audit_pages.id;


--
-- Name: site_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_audits (
    id integer NOT NULL,
    website_id integer NOT NULL,
    status public.site_audit_status DEFAULT 'queued'::public.site_audit_status NOT NULL,
    pages_found integer DEFAULT 0 NOT NULL,
    pages_crawled integer DEFAULT 0 NOT NULL,
    health_score integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.site_audits OWNER TO postgres;

--
-- Name: site_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.site_audits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_audits_id_seq OWNER TO postgres;

--
-- Name: site_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.site_audits_id_seq OWNED BY public.site_audits.id;


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_posts (
    id integer NOT NULL,
    website_id integer NOT NULL,
    campaign_id integer,
    platform text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp with time zone,
    published_at timestamp with time zone,
    media_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.social_posts OWNER TO postgres;

--
-- Name: social_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.social_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_posts_id_seq OWNER TO postgres;

--
-- Name: social_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.social_posts_id_seq OWNED BY public.social_posts.id;


--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role public.staff_role DEFAULT 'staff'::public.staff_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    permissions jsonb DEFAULT 'null'::jsonb,
    plan public.staff_plan DEFAULT 'starter'::public.staff_plan NOT NULL,
    email text,
    byok_provider text,
    byok_api_key text,
    byok_enabled boolean DEFAULT false NOT NULL,
    home_dir text
);


ALTER TABLE public.staff_users OWNER TO postgres;

--
-- Name: staff_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_users_id_seq OWNER TO postgres;

--
-- Name: staff_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_users_id_seq OWNED BY public.staff_users.id;


--
-- Name: utm_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.utm_links (
    id integer NOT NULL,
    destination_url text NOT NULL,
    source text NOT NULL,
    medium text NOT NULL,
    campaign text NOT NULL,
    term text,
    content text,
    label text,
    clicks integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    website_id integer
);


ALTER TABLE public.utm_links OWNER TO postgres;

--
-- Name: utm_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.utm_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.utm_links_id_seq OWNER TO postgres;

--
-- Name: utm_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.utm_links_id_seq OWNED BY public.utm_links.id;


--
-- Name: visitor_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visitor_sessions (
    visitor_id text NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_hash text,
    user_agent text,
    heartbeat_at timestamp with time zone
);


ALTER TABLE public.visitor_sessions OWNER TO postgres;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id integer NOT NULL,
    provider text NOT NULL,
    event_type text NOT NULL,
    event_id text,
    status text DEFAULT 'received'::text NOT NULL,
    payload jsonb,
    error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webhook_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.webhook_events_id_seq OWNER TO postgres;

--
-- Name: webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webhook_events_id_seq OWNED BY public.webhook_events.id;


--
-- Name: websites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.websites (
    id integer NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    niche text NOT NULL,
    seo_score integer,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    public_share_token text
);


ALTER TABLE public.websites OWNER TO postgres;

--
-- Name: websites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.websites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.websites_id_seq OWNER TO postgres;

--
-- Name: websites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.websites_id_seq OWNED BY public.websites.id;


--
-- Name: ab_tests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_tests ALTER COLUMN id SET DEFAULT nextval('public.ab_tests_id_seq'::regclass);


--
-- Name: ab_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_variants ALTER COLUMN id SET DEFAULT nextval('public.ab_variants_id_seq'::regclass);


--
-- Name: ai_usage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: backlinks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlinks ALTER COLUMN id SET DEFAULT nextval('public.backlinks_id_seq'::regclass);


--
-- Name: blog_posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts ALTER COLUMN id SET DEFAULT nextval('public.blog_posts_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- Name: chatbot_conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_conversations ALTER COLUMN id SET DEFAULT nextval('public.chatbot_conversations_id_seq'::regclass);


--
-- Name: client_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_reports ALTER COLUMN id SET DEFAULT nextval('public.client_reports_id_seq'::regclass);


--
-- Name: competitor_analyses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_analyses ALTER COLUMN id SET DEFAULT nextval('public.competitor_analyses_id_seq'::regclass);


--
-- Name: competitor_research_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_research_sessions ALTER COLUMN id SET DEFAULT nextval('public.competitor_research_sessions_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: ga4_cache id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ga4_cache ALTER COLUMN id SET DEFAULT nextval('public.ga4_cache_id_seq'::regclass);


--
-- Name: gallery_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gallery_images ALTER COLUMN id SET DEFAULT nextval('public.gallery_images_id_seq'::regclass);


--
-- Name: gsc_cache id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gsc_cache ALTER COLUMN id SET DEFAULT nextval('public.gsc_cache_id_seq'::regclass);


--
-- Name: health_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.health_snapshots ALTER COLUMN id SET DEFAULT nextval('public.health_snapshots_id_seq'::regclass);


--
-- Name: ip_allowlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_allowlist ALTER COLUMN id SET DEFAULT nextval('public.ip_allowlist_id_seq'::regclass);


--
-- Name: ip_rate_limits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_rate_limits ALTER COLUMN id SET DEFAULT nextval('public.ip_rate_limits_id_seq'::regclass);


--
-- Name: kb_articles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kb_articles ALTER COLUMN id SET DEFAULT nextval('public.kb_articles_id_seq'::regclass);


--
-- Name: keyword_rank_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_rank_history ALTER COLUMN id SET DEFAULT nextval('public.keyword_rank_history_id_seq'::regclass);


--
-- Name: keyword_research_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_research_sessions ALTER COLUMN id SET DEFAULT nextval('public.keyword_research_sessions_id_seq'::regclass);


--
-- Name: keywords id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keywords ALTER COLUMN id SET DEFAULT nextval('public.keywords_id_seq'::regclass);


--
-- Name: lead_forms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_forms ALTER COLUMN id SET DEFAULT nextval('public.lead_forms_id_seq'::regclass);


--
-- Name: lead_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes ALTER COLUMN id SET DEFAULT nextval('public.lead_notes_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: link_suggestions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.link_suggestions ALTER COLUMN id SET DEFAULT nextval('public.link_suggestions_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: media_assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_assets ALTER COLUMN id SET DEFAULT nextval('public.media_assets_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: oauth_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.oauth_tokens_id_seq'::regclass);


--
-- Name: outreach_contacts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outreach_contacts ALTER COLUMN id SET DEFAULT nextval('public.outreach_contacts_id_seq'::regclass);


--
-- Name: page_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_views ALTER COLUMN id SET DEFAULT nextval('public.page_views_id_seq'::regclass);


--
-- Name: pagespeed_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagespeed_results ALTER COLUMN id SET DEFAULT nextval('public.pagespeed_results_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: security_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events ALTER COLUMN id SET DEFAULT nextval('public.security_events_id_seq'::regclass);


--
-- Name: seo_audits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seo_audits ALTER COLUMN id SET DEFAULT nextval('public.seo_audits_id_seq'::regclass);


--
-- Name: sequence_enrollments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequence_enrollments ALTER COLUMN id SET DEFAULT nextval('public.sequence_enrollments_id_seq'::regclass);


--
-- Name: sequences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequences ALTER COLUMN id SET DEFAULT nextval('public.sequences_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: site_audit_issues id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_issues ALTER COLUMN id SET DEFAULT nextval('public.site_audit_issues_id_seq'::regclass);


--
-- Name: site_audit_pages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_pages ALTER COLUMN id SET DEFAULT nextval('public.site_audit_pages_id_seq'::regclass);


--
-- Name: site_audits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audits ALTER COLUMN id SET DEFAULT nextval('public.site_audits_id_seq'::regclass);


--
-- Name: social_posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_posts ALTER COLUMN id SET DEFAULT nextval('public.social_posts_id_seq'::regclass);


--
-- Name: staff_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_users ALTER COLUMN id SET DEFAULT nextval('public.staff_users_id_seq'::regclass);


--
-- Name: utm_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utm_links ALTER COLUMN id SET DEFAULT nextval('public.utm_links_id_seq'::regclass);


--
-- Name: webhook_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events ALTER COLUMN id SET DEFAULT nextval('public.webhook_events_id_seq'::regclass);


--
-- Name: websites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.websites ALTER COLUMN id SET DEFAULT nextval('public.websites_id_seq'::regclass);


--
-- Data for Name: ab_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ab_tests (id, name, type, status, winner_threshold, notes, created_at, updated_at) FROM stdin;
3	Landing Page CTA Test	cta	active	100	\N	2026-04-29 08:39:34.708218+00	2026-04-29 08:39:34.708218+00
4	Fix Verification Test	cta	active	100	\N	2026-04-29 10:53:23.919567+00	2026-04-29 10:53:23.919567+00
1	Homepage Headline Test	headline	active	50	\N	2026-04-29 08:34:00.545526+00	2026-04-29 10:56:18.255+00
\.


--
-- Data for Name: ab_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ab_variants (id, test_id, name, content, impressions, clicks, created_at) FROM stdin;
1	1	Variant A	Boost Your SEO in 30 Days	1	1	2026-04-29 08:34:00.554396+00
5	3	Variant A	Start Free Today	0	0	2026-04-29 08:39:34.742032+00
6	3	Variant B	Get Your Free Trial	0	0	2026-04-29 08:39:34.742032+00
8	4	B	Get Started	0	0	2026-04-29 10:53:23.919567+00
2	1	Variant B	Grow Organic Traffic Fast	1	0	2026-04-29 08:34:00.554396+00
\.


--
-- Data for Name: ai_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_usage (id, user_id, type, year_month, count, updated_at) FROM stdin;
1	1	text	2026-04	5	2026-04-28 07:09:21.482+00
6	1	text	2026-05	16	2026-05-08 07:59:48.219+00
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (id, key, value, updated_at) FROM stdin;
16	email_from_address	alerts@mysite.com	2026-05-02 10:38:30.276+00
19	email_smtp_port	587	2026-05-02 10:38:30.289+00
72	email_mailchimp_send_mode	direct	2026-05-02 10:38:30.29408+00
66	rank_alerts_email_enabled	true	2026-05-02 10:38:38.982+00
67	rank_alerts_email_to	alerts@mysite.com	2026-05-02 10:38:38.986+00
10	fal_video_model	fal-ai/minimax/video-01	2026-04-24 05:54:22.746+00
9	fal_image_model	fal-ai/flux/schnell	2026-04-24 05:56:50.469+00
14	ai_usage_limit_text	300	2026-04-24 07:56:39.247855+00
76	chatbot_enabled	true	2026-05-08 15:25:25.980129+00
77	chatbot_name	Test Bot	2026-05-08 15:25:25.986107+00
78	site_code_head_html	<meta name="x-test" content="1">	2026-05-08 15:26:07.765261+00
79	site_code_body_html	<!-- analytics -->	2026-05-08 15:26:07.769937+00
15	email_provider	mailchimp	2026-04-24 09:25:26.954+00
17	email_from_name	Test Co	2026-04-24 09:25:27.301+00
18	email_api_key	enc:PgVeM07j9mEm42wFpVR9A9jq+/5D8MOxgFUbH0whNUXwCYR/4YjvZw==	2026-04-24 09:25:27.308+00
31	email_mailchimp_audience_id	abc123	2026-04-24 09:25:27.314508+00
40	stripe_publishable_key	pk_test_fixed123	2026-04-28 14:11:00.959+00
38	active_payment_provider	razorpay	2026-04-28 14:23:13.289+00
39	payment_default_currency	inr	2026-04-28 14:25:59.374+00
1	ai_provider	replit	2026-05-01 07:22:58.116+00
2	ai_model	gpt-4.1	2026-05-01 07:22:58.149+00
5	ai_enabled	true	2026-05-01 07:22:58.162+00
63	onboarding_steps	[{"id":"add_website","label":"Add your first website","href":"/websites","enabled":true},{"id":"run_audit","label":"Run a site audit","href":"/websites","enabled":true},{"id":"track_keyword","label":"Track a keyword","href":"/keywords","enabled":true},{"id":"create_campaign","label":"Create a campaign","href":"/campaigns","enabled":true},{"id":"custom_1234567890","label":"Book kickoff call","href":"https://calendly.com/test","enabled":true,"description":"Schedule a 30-min call"}]	2026-05-01 11:40:51.004+00
32	lead_scoring_config	{"source":{"paid":10,"referral":10,"social":10,"organic":10,"direct":10},"status":{"qualified":30,"contacted":20,"new":10,"converted":0,"lost":0},"valueTier":{"over1000":20,"over500":15,"over100":10,"over0":5},"recencyBonus":10}	2026-05-01 18:34:03.953+00
\.


--
-- Data for Name: backlinks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backlinks (id, website_id, prospect_url, prospect_domain, contact_email, status, domain_authority, type, notes, created_at, updated_at) FROM stdin;
1	1	https://healthline.com/contributors	healthline.com	contributors@healthline.com	contacted	93	guest_post	Submitted pitch for protein powder article	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
2	1	https://everydayhealth.com/write-for-us	everydayhealth.com	\N	not_contacted	78	guest_post	High DA health site	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
3	1	https://fitnessblender.com/resources	fitnessblender.com	links@fitnessblender.com	responded	71	resource	Positive response, waiting for final approval	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
4	2	https://techcrunch.com	techcrunch.com	\N	not_contacted	94	guest_post	Tier 1 tech media	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
5	2	https://pcmag.com/resources	pcmag.com	editorial@pcmag.com	link_secured	86	resource	Link live on best-of-laptops resource page	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
6	2	https://theverge.com/community	theverge.com	\N	contacted	91	forum	Engaged in forum, building relationship	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
7	3	https://houzz.com/directories	houzz.com	\N	link_secured	89	directory	Listed in home improvement directory	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
8	3	https://bhg.com/write-for-us	bhg.com	editorial@bhg.com	contacted	82	guest_post	Pitch sent for small spaces article	2026-04-23 05:45:12.016794+00	2026-04-23 05:45:12.016794+00
9	1	https://nerdfitness.com	nerdfitness.com	\N	not_contacted	76	guest_post	Share an expert guide on creating personalized workout plans for busy professionals.	2026-05-02 12:18:08.439248+00	2026-05-02 12:18:08.439248+00
\.


--
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_posts (id, title, slug, excerpt, content, category, tags, author, seo_title, seo_description, reading_time, featured, status, published_at, created_at, updated_at, featured_image, featured_in_rss, featured_order) FROM stdin;
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, name, slug, logo_url, website_url, description, created_at, updated_at) FROM stdin;
1	Acme	acme	\N	https://acme.test	\N	2026-05-08 14:02:44.190121+00	2026-05-08 14:02:44.190121+00
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, website_id, name, type, goal, budget, status, start_date, end_date, notes, impressions, clicks, conversions, spend, created_at, updated_at, sent_at, sent_count) FROM stdin;
1	1	Q1 Organic Content Push	organic	Increase organic traffic by 40%	2000.00	active	\N	\N	\N	45000	2300	185	0.00	2026-04-23 05:44:35.1552+00	2026-04-23 05:44:35.1552+00	\N	\N
2	1	Instagram Fitness Series	social	Grow Instagram following to 10k	800.00	active	\N	\N	\N	32000	1800	95	650.00	2026-04-23 05:44:35.1552+00	2026-04-23 05:44:35.1552+00	\N	\N
3	2	Google Ads - Laptops	paid	Drive 500 monthly signups	5000.00	active	\N	\N	\N	120000	4500	320	4200.00	2026-04-23 05:44:35.1552+00	2026-04-23 05:44:35.1552+00	\N	\N
4	2	Tech Newsletter Launch	email	Get 1000 email subscribers	500.00	planning	\N	\N	\N	\N	\N	\N	\N	2026-04-23 05:44:35.1552+00	2026-04-23 05:44:35.1552+00	\N	\N
5	3	Pinterest Home Decor	social	Increase Pinterest referral traffic	300.00	active	\N	\N	\N	18000	960	72	280.00	2026-04-23 05:44:35.1552+00	2026-04-23 05:44:35.1552+00	\N	\N
\.


--
-- Data for Name: chatbot_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chatbot_conversations (id, visitor_id, ip, user_agent, page_url, messages, created_at, updated_at) FROM stdin;
1	test_v1	::1	curl/8.14.1	\N	[{"at": "2026-05-08T15:25:27.389Z", "role": "user", "content": "Hi, tell me about your services in one sentence"}, {"at": "2026-05-08T15:25:27.390Z", "role": "assistant", "content": "We offer comprehensive marketing solutions designed to help your business grow, including digital marketing, branding, and strategy services."}]	2026-05-08 15:25:26.089024+00	2026-05-08 15:25:27.39+00
2	verify_v1	::1	curl/8.14.1	\N	[{"at": "2026-05-08T15:29:57.401Z", "role": "user", "content": "ping"}, {"at": "2026-05-08T15:29:57.401Z", "role": "assistant", "content": "Hello! How can I help you today? If you have any questions about our products or services, just let me know."}]	2026-05-08 15:29:56.167925+00	2026-05-08 15:29:57.402+00
3	verify_v2	::1	curl/8.14.1	\N	[{"at": "2026-05-08T15:33:55.140Z", "role": "user", "content": "hi"}, {"at": "2026-05-08T15:33:55.141Z", "role": "assistant", "content": "Hello! How can I help you today?"}]	2026-05-08 15:33:54.333348+00	2026-05-08 15:33:55.141+00
\.


--
-- Data for Name: client_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_reports (id, website_id, title, date_range_start, date_range_end, sections, snapshot, share_token, created_at, updated_at) FROM stdin;
1	1	Test Performance Report May 2026	2026-04-01	2026-04-30	["seo_summary", "keywords", "leads"]	{"leads": {"total": 8, "bySource": {"form": 2, "paid": 1, "social": 1, "organic": 3, "referral": 1}, "byStatus": {"new": 4, "contacted": 1, "converted": 1, "qualified": 2}, "periodCount": 8}, "website": {"id": 1, "url": "https://fitlifeblog.com", "name": "FitLife Blog", "niche": "Health & Fitness", "status": "active", "seoScore": 78}, "keywords": {"total": 6, "topKeywords": [{"intent": null, "status": "tracking", "cluster": null, "keyword": "yoga for flexibility", "difficulty": 38, "currentRank": 2, "searchVolume": 6800}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "best protein powder", "difficulty": 72, "currentRank": 4, "searchVolume": 18000}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "weight loss tips for beginners", "difficulty": 60, "currentRank": 7, "searchVolume": 14200}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "morning workout routine", "difficulty": 45, "currentRank": 12, "searchVolume": 9500}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "test keyword rank monitoring", "difficulty": null, "currentRank": 15, "searchVolume": null}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "healthy meal prep ideas", "difficulty": 55, "currentRank": 19, "searchVolume": 22000}]}, "generatedAt": "2026-04-30T10:06:29.264Z"}	c5b61001a6358164c6c685d2f3a5afa997aeacf68189bb22	2026-04-30 10:06:29.272035+00	2026-04-30 10:06:29.272035+00
2	1	E2E Test Report Apr 2026	2026-04-01	2026-04-30	["seo_summary", "keywords", "leads"]	{"leads": {"total": 8, "bySource": {"form": 2, "paid": 1, "social": 1, "organic": 3, "referral": 1}, "byStatus": {"new": 4, "contacted": 1, "converted": 1, "qualified": 2}, "periodCount": 8}, "website": {"id": 1, "url": "https://fitlifeblog.com", "name": "FitLife Blog", "niche": "Health & Fitness", "status": "active", "seoScore": 78}, "keywords": {"total": 6, "topKeywords": [{"intent": null, "status": "tracking", "cluster": null, "keyword": "yoga for flexibility", "difficulty": 38, "currentRank": 2, "searchVolume": 6800}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "best protein powder", "difficulty": 72, "currentRank": 4, "searchVolume": 18000}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "weight loss tips for beginners", "difficulty": 60, "currentRank": 7, "searchVolume": 14200}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "morning workout routine", "difficulty": 45, "currentRank": 12, "searchVolume": 9500}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "test keyword rank monitoring", "difficulty": null, "currentRank": 15, "searchVolume": null}, {"intent": null, "status": "tracking", "cluster": null, "keyword": "healthy meal prep ideas", "difficulty": 55, "currentRank": 19, "searchVolume": 22000}]}, "generatedAt": "2026-04-30T10:13:07.004Z"}	dacc487625dc7ac46620a09043b7969bc88883a18abf138a	2026-04-30 10:12:48.127842+00	2026-04-30 10:13:07.009+00
\.


--
-- Data for Name: competitor_analyses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competitor_analyses (id, website_id, competitor_url, analysis_json, created_at) FROM stdin;
\.


--
-- Data for Name: competitor_research_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competitor_research_sessions (id, staff_user_id, domain, result, cached_until, created_at) FROM stdin;
1	1	ahrefs.com	{"contentTopics": [{"topic": "Ahrefs vs Semrush comparison", "description": "Head-to-head review detailing feature differences, pricing, and value for various user segments; a high-intent traffic driver for tool shoppers."}, {"topic": "Complete keyword research tutorial", "description": "Step-by-step guide to finding, analyzing, and prioritizing keywords, designed to showcase Ahrefs’ capabilities in practical workflows."}, {"topic": "Google algorithm update explainer", "description": "Timely, authoritative guides on recent and major core updates that attract SEOs concerned about traffic changes."}, {"topic": "Beginner’s guide to backlinks", "description": "Introductory content breaking down backlink concepts, with educational visuals and actionable steps using Ahrefs."}, {"topic": "SEO case study: On-page optimization", "description": "In-depth before-and-after analysis on client or in-house projects to build credibility and demonstrate measurable ROI."}, {"topic": "List of free SEO tools", "description": "Well-structured directory of valuable free tools including, but not limited to, Ahrefs’ own; a link magnet for resource seekers."}, {"topic": "How to recover from Google penalties", "description": "Diagnostic workflows and practical, tool-based solutions for websites impacted by penalties or major traffic drops."}, {"topic": "Content audit checklist", "description": "Detailed checklist or template for assessing website content, guiding readers through each audit step often with Ahrefs tools."}, {"topic": "YouTube SEO ranking factors", "description": "Explores detailed ranking criteria and optimization tactics for YouTube, catering to video marketers in the Ahrefs audience."}], "keywordThemes": [{"theme": "SEO tools comparison", "intent": "commercial", "difficulty": 65, "volumeBand": "1K-10K", "description": "This theme focuses on comparing popular SEO tools, helping users make purchasing decisions based on features, pricing, and capabilities. Ahrefs targets these to capture buyers in the consideration stage."}, {"theme": "Keyword research guides", "intent": "informational", "difficulty": 52, "volumeBand": "1K-10K", "description": "Covering methodologies and strategies for keyword research, these guides attract marketers looking to improve their SEO skills and funnel them toward using Ahrefs’ own tools."}, {"theme": "Link building strategies", "intent": "informational", "difficulty": 48, "volumeBand": "1K-10K", "description": "Detailed articles on acquiring backlinks, best practices, and outreach. Targets users seeking actionable tactics where Ahrefs’ toolset provides direct solutions."}, {"theme": "Technical SEO issues", "intent": "informational", "difficulty": 60, "volumeBand": "1K-10K", "description": "Guides addressing crawling, indexing, and site health topics help Ahrefs capture advanced SEOs troubleshooting site problems."}, {"theme": "Backlink analysis", "intent": "commercial", "difficulty": 55, "volumeBand": "1K-10K", "description": "Resources and comparisons for backlink checkers position Ahrefs as a leading solution for this essential SEO task."}, {"theme": "Site audit tutorials", "intent": "informational", "difficulty": 45, "volumeBand": "100-1K", "description": "Explains how to perform comprehensive website audits, both conceptually and via Ahrefs’ own products, appealing to SMBs and agencies."}, {"theme": "Competitor analysis", "intent": "informational", "difficulty": 58, "volumeBand": "1K-10K", "description": "Discussing methods to analyze and outperform SEO competitors, these articles use screenshots and data to show Ahrefs in action."}, {"theme": "SEO case studies", "intent": "informational", "difficulty": 38, "volumeBand": "100-1K", "description": "Stories of real-world SEO improvements attract both learners and potential tool buyers through relatable examples."}, {"theme": "Content marketing strategy", "intent": "informational", "difficulty": 61, "volumeBand": "1K-10K", "description": "These guides cover the entire content creation and promotion lifecycle, positioning Ahrefs’ tools as the backbone for planning and measurement."}, {"theme": "YouTube SEO", "intent": "informational", "difficulty": 42, "volumeBand": "100-1K", "description": "Targeting video marketers, Ahrefs explains optimizations for YouTube search and cross-platform visibility."}, {"theme": "Local SEO tips", "intent": "informational", "difficulty": 35, "volumeBand": "100-1K", "description": "Practical advice for ranking in local searches appeals to service businesses and drives adoption of Ahrefs’ local features."}, {"theme": "SEO news and trends", "intent": "informational", "difficulty": 27, "volumeBand": "<100", "description": "Regular updates keep audiences informed on Google algorithm changes and industry shifts, positioning Ahrefs as a go-to expert source."}], "domainOverview": {"niche": "SEO tools and tutorials", "summary": "Ahrefs.com drives organic traffic by publishing comprehensive SEO guides, tool comparisons, and actionable tutorials targeted toward marketers and business owners. Their authority and topical depth enable top rankings for both competitive commercial tool queries and long-tail informational SEO searches.", "industry": "Digital marketing, SaaS", "authority": 91, "trafficBand": "1M+"}, "gapOpportunities": [{"intent": "informational", "keyword": "seo site migration checklist", "rationale": "There are few comprehensive guides on SEO-safe site migrations, making this a low-competition opportunity relevant to mid-level users.", "difficulty": 36, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "image seo best practices", "rationale": "This niche keyword has rising search demand and is underserved by authoritative, actionable content.", "difficulty": 28, "volumeBand": "100-1K"}, {"intent": "commercial", "keyword": "hiring an seo consultant", "rationale": "This term targets high-intent businesses considering expert help, an audience increasingly seeking unbiased tool recommendations.", "difficulty": 39, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "seo reporting template", "rationale": "SEO agencies regularly seek reporting templates, presenting link and engagement opportunity Ahrefs is not currently targeting.", "difficulty": 33, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "international seo strategy", "rationale": "In-depth content on international SEO is sparse, and authoritative guidance would attract an advanced and enterprise audience.", "difficulty": 44, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "seo for wordpress sites", "rationale": "Ahrefs can capture a large blogging and SMB segment with an actionable platform-specific SEO guide.", "difficulty": 51, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "mobile seo audit", "rationale": "Mobile-first indexing makes this keyword increasingly important; current top results lack tool-integrated workflows.", "difficulty": 29, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "best seo chrome extensions", "rationale": "This growing opportunity matches users looking for quick, free tools and may also promote Ahrefs’ own extension.", "difficulty": 27, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "seo data visualization", "rationale": "Few high-quality resources exist on this technical SEO niche and Ahrefs could provide unique tool integration examples.", "difficulty": 34, "volumeBand": "<100"}, {"intent": "informational", "keyword": "gmb optimization checklist", "rationale": "With the importance of Google My Business, a structured checklist is frequently searched and underrepresented in major SEO publications.", "difficulty": 41, "volumeBand": "100-1K"}]}	2026-05-02 07:51:30.294+00	2026-05-01 07:51:50.722138+00
2	1	moz.com	{"contentTopics": [{"topic": "Beginner's Guide to SEO", "description": "A comprehensive onboarding page that dominates the landscape for new SEOs and consistently drives high-intent traffic."}, {"topic": "Google Algorithm Update Analysis", "description": "In-depth blog posts reacting to and analyzing major search engine updates, attracting visitors seeking timely strategic advice."}, {"topic": "MozBar Tool Landing Page", "description": "A focused landing page for their browser extension, appealing to users researching free and easy SEO utilities."}, {"topic": "Domain Authority Explained", "description": "Authoritative long-form content that explains Moz's proprietary metric, drawing interest from both new and experienced marketers."}, {"topic": "SEO Software Feature Comparison", "description": "Comparison pages for Moz's software versus competitors, targeting buyers in the consideration stage."}, {"topic": "Local Search Ranking Factors Report", "description": "Industry-leading research content that attracts B2B and agency audiences seeking detailed insights into local ranking."}, {"topic": "Whiteboard Friday Video Series", "description": "A weekly educational video content series that captures recurring, loyal traffic from the SEO community."}, {"topic": "SEO Audit Checklist", "description": "Practical checklists and templates for conducting technical and on-page audits—a proven traffic generator for operational SEO searches."}, {"topic": "Link Building Tactics Resource", "description": "Resource hubs and guides compiling strategy, expanding their authority and linkable asset footprint on high-value topics."}], "keywordThemes": [{"theme": "link building strategies", "intent": "informational", "difficulty": 65, "volumeBand": "1K-10K", "description": "Moz focuses on educating users about effective and ethical link building tactics, a competitive SEO area, to attract marketers seeking long-term growth."}, {"theme": "on-page SEO techniques", "intent": "informational", "difficulty": 52, "volumeBand": "1K-10K", "description": "This theme covers technical and content-related optimizations, helping businesses and individuals improve site ranking through actionable tips."}, {"theme": "SEO beginner guides", "intent": "informational", "difficulty": 35, "volumeBand": "10K+", "description": "Moz's beginner guides break down complex SEO concepts for newcomers, driving high traffic and establishing authority in SEO education."}, {"theme": "keyword research tools", "intent": "commercial", "difficulty": 70, "volumeBand": "1K-10K", "description": "Showcasing their toolset while comparing alternatives, Moz targets businesses evaluating the best keyword research tools for their needs."}, {"theme": "local SEO tips", "intent": "informational", "difficulty": 48, "volumeBand": "1K-10K", "description": "Guides and case studies for improving local business visibility attract SMBs and agencies focused on local search success."}, {"theme": "SEO industry news", "intent": "informational", "difficulty": 40, "volumeBand": "100-1K", "description": "Moz delivers timely updates about algorithm changes and industry developments, appealing to a professional audience staying ahead of trends."}, {"theme": "technical SEO audits", "intent": "informational", "difficulty": 62, "volumeBand": "100-1K", "description": "Content about diagnosing site issues and step-by-step technical audits positions Moz as a trusted resource for advanced optimizations."}, {"theme": "SEO software comparisons", "intent": "commercial", "difficulty": 57, "volumeBand": "1K-10K", "description": "Product roundup content drives traffic from users in the research phase, offering side-by-side comparisons with competitors."}, {"theme": "SERP feature tracking", "intent": "informational", "difficulty": 30, "volumeBand": "100-1K", "description": "Covering tools and guides related to monitoring SERP features helps users target rich results and understand Google changes."}, {"theme": "site authority metrics", "intent": "informational", "difficulty": 44, "volumeBand": "1K-10K", "description": "As creators of Domain Authority, Moz educates about authority metrics to position their scoring as industry standard."}, {"theme": "SEO case studies", "intent": "informational", "difficulty": 28, "volumeBand": "100-1K", "description": "Real-world SEO campaign results appeal to readers seeking proof and actionable insights with lower competition for rankings."}, {"theme": "search engine ranking factors", "intent": "informational", "difficulty": 60, "volumeBand": "1K-10K", "description": "Moz frequently analyzes and updates content on ranking factors, addressing a core curiosity for SEOs and decision makers."}], "domainOverview": {"niche": "SEO tools and education", "summary": "Moz.com is a leading authority in the SEO industry, leveraging high-quality guides, actionable blog posts, and popular tools to capture organic traffic. Its strategy emphasizes comprehensive educational content and utility-based services tailored to marketers and small business owners.", "industry": "digital marketing", "authority": 87, "trafficBand": "100K-1M"}, "gapOpportunities": [{"intent": "informational", "keyword": "seo reporting templates", "rationale": "High demand exists among agencies and freelancers for ready-to-use reporting formats, which Moz has minimal existing coverage for.", "difficulty": 34, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "structured data generator", "rationale": "Few authoritative guides or free tools exist, and Moz could attract developers and small businesses by providing resources here.", "difficulty": 27, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "google search operator list", "rationale": "SEOs and researchers frequently seek updated operator lists, which fit Moz’s editorial strengths but are only lightly touched.", "difficulty": 20, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "seo for nonprofits", "rationale": "Nonprofits need tailored SEO guidance, representing a growing content area where Moz currently under-serves the audience.", "difficulty": 36, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "image seo optimization", "rationale": "There are increasing searches for image-specific SEO tactics, which Moz has not addressed in-depth within recent content.", "difficulty": 38, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "seo glossary", "rationale": "An updated, accessible SEO glossary attracts beginners; existing content is thin and aged across most competitors.", "difficulty": 12, "volumeBand": "100-1K"}, {"intent": "informational", "keyword": "seo audit template", "rationale": "Templates and downloadable assets perform well in SERPs, and Moz's competitors are earning substantial leads here.", "difficulty": 42, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "voice search seo", "rationale": "This emerging subtopic of SEO is rapidly growing, with little comprehensive content from Moz.", "difficulty": 47, "volumeBand": "1K-10K"}, {"intent": "informational", "keyword": "seo for wordpress sites", "rationale": "WordPress dominates the CMS market and tailored SEO guides consistently rank and attract high volume traffic.", "difficulty": 57, "volumeBand": "10K+"}, {"intent": "informational", "keyword": "seo site migration checklist", "rationale": "Site migrations are risky and technical; practical checklists see high engagement and drive authority-building links.", "difficulty": 33, "volumeBand": "100-1K"}]}	2026-05-02 07:52:55.077+00	2026-05-01 07:53:15.557327+00
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, title, created_at, lead_id) FROM stdin;
1	Qualify: Lisa Thompson	2026-04-27 16:23:55.167431+00	8
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coupons (id, code, discount_type, discount_value, applies_to, max_uses, used_count, expires_at, is_active, created_at) FROM stdin;
1	TEST20	percent	20	all	100	0	\N	t	2026-05-02 12:45:50.91591+00
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_templates (id, website_id, name, subject, body, created_at, updated_at) FROM stdin;
1	\N	Test Tpl	Hello	World body content	2026-05-01 18:21:01.643095+00	2026-05-01 18:21:01.643095+00
2	\N	Newsletter Base	Monthly Newsletter - {{month}}	Hello {{name}}, here is your monthly update.	2026-05-01 18:23:30.989352+00	2026-05-01 18:23:30.989352+00
\.


--
-- Data for Name: ga4_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ga4_cache (id, website_id, cache_key, data, cached_at) FROM stdin;
\.


--
-- Data for Name: gallery_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gallery_images (id, gallery_type, url, caption, category_tag, location_tag, sort_order, created_at, seo_title, seo_description) FROM stdin;
1	main	https://example.com/1.jpg	Sample	Outdoor	\N	0	2026-05-08 14:02:44.618073+00	\N	\N
2	main	https://example.com/2.jpg	Sample	Outdoor	\N	1	2026-05-08 14:02:44.618073+00	\N	\N
\.


--
-- Data for Name: gsc_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gsc_cache (id, website_id, date_range, data, cached_at) FROM stdin;
\.


--
-- Data for Name: health_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.health_snapshots (id, cpu_pct, mem_used_bytes, mem_total_bytes, disk_used_bytes, disk_total_bytes, db_size_bytes, page_views_24h, active_visitors, extra, created_at) FROM stdin;
\.


--
-- Data for Name: ip_allowlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ip_allowlist (id, ip, note, created_at) FROM stdin;
\.


--
-- Data for Name: ip_rate_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ip_rate_limits (id, ip, feature, url, date, count, last_request_at) FROM stdin;
1	::1	lead_form_1	/public/forms/1/submit	2026-04-28	1	2026-04-28 08:24:44.411+00
2	::1	lead_form_3	/public/forms/3/submit	2026-04-28	2	2026-04-28 08:32:48.301+00
3	127.0.0.1	public_audit	https://pacdemo.nextehost.com/	2026-04-28	2	2026-04-28 17:09:25.321+00
4	::1	public_chatbot	\N	2026-05-08	2	2026-05-08 15:29:57.405+00
5	visitor:verify_v2	public_chatbot	\N	2026-05-08	1	2026-05-08 15:33:55.144+00
6	::1	public_chatbot_ip	\N	2026-05-08	1	2026-05-08 15:33:55.159+00
\.


--
-- Data for Name: kb_articles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kb_articles (id, title, slug, excerpt, content, category, subcategory, tags, helpful, not_helpful, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: keyword_rank_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.keyword_rank_history (id, keyword_id, rank, recorded_date, created_at) FROM stdin;
1	1	4	2026-04-24	2026-04-24 13:11:31.883028+00
2	2	12	2026-04-24	2026-04-24 13:11:31.886716+00
3	3	7	2026-04-24	2026-04-24 13:11:31.889804+00
4	4	2	2026-04-24	2026-04-24 13:11:31.89369+00
5	5	19	2026-04-24	2026-04-24 13:11:31.897291+00
6	6	9	2026-04-24	2026-04-24 13:11:31.900053+00
7	7	5	2026-04-24	2026-04-24 13:11:31.903504+00
8	8	14	2026-04-24	2026-04-24 13:11:31.907529+00
9	9	3	2026-04-24	2026-04-24 13:11:31.910098+00
10	10	6	2026-04-24	2026-04-24 13:11:31.913256+00
11	11	11	2026-04-24	2026-04-24 13:11:31.916093+00
12	12	8	2026-04-24	2026-04-24 13:11:31.919533+00
13	13	15	2026-04-24	2026-04-24 13:11:31.922434+00
66	1	4	2026-04-30	2026-04-30 10:26:59.697587+00
67	2	12	2026-04-30	2026-04-30 10:26:59.704388+00
68	3	7	2026-04-30	2026-04-30 10:26:59.707292+00
69	4	2	2026-04-30	2026-04-30 10:26:59.710868+00
70	5	19	2026-04-30	2026-04-30 10:26:59.714227+00
71	6	9	2026-04-30	2026-04-30 10:26:59.717252+00
72	7	5	2026-04-30	2026-04-30 10:26:59.720218+00
73	8	14	2026-04-30	2026-04-30 10:26:59.723613+00
74	9	3	2026-04-30	2026-04-30 10:26:59.726278+00
75	10	6	2026-04-30	2026-04-30 10:26:59.729423+00
76	11	11	2026-04-30	2026-04-30 10:26:59.731834+00
77	12	8	2026-04-30	2026-04-30 10:26:59.735189+00
78	13	15	2026-04-30	2026-04-30 10:26:59.738508+00
\.


--
-- Data for Name: keyword_research_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.keyword_research_sessions (id, staff_user_id, website_id, seed_input, suggestions, created_at) FROM stdin;
1	1	\N	content marketing	[{"intent": "informational", "keyword": "content marketing strategy", "difficulty": 70, "volumeBand": "1K-10K", "contentAngle": "Guides and frameworks for building effective content marketing strategies that attract targeted audiences."}, {"intent": "commercial", "keyword": "content marketing services", "difficulty": 65, "volumeBand": "1K-10K", "contentAngle": "Service pages and lists of agencies showcasing solutions for outsourcing content marketing."}, {"intent": "informational", "keyword": "b2b content marketing examples", "difficulty": 38, "volumeBand": "100-1K", "contentAngle": "Case studies and curated examples demonstrating successful B2B content marketing in practice."}, {"intent": "informational", "keyword": "content marketing for small business", "difficulty": 28, "volumeBand": "100-1K", "contentAngle": "Actionable tips and tailored guides for small business owners looking to grow organically with content."}, {"intent": "commercial", "keyword": "best content marketing tools", "difficulty": 61, "volumeBand": "1K-10K", "contentAngle": "Comparisons and reviews of popular tools to help marketers improve their content planning and distribution."}, {"intent": "transactional", "keyword": "hire content marketing agency", "difficulty": 48, "volumeBand": "100-1K", "contentAngle": "Landing pages and vendor lists targeting decision makers ready to select a content marketing agency."}, {"intent": "informational", "keyword": "content marketing checklist", "difficulty": 22, "volumeBand": "100-1K", "contentAngle": "Downloadable or printable checklists to help marketers ensure nothing is missed during campaigns."}, {"intent": "informational", "keyword": "content marketing calendar template", "difficulty": 25, "volumeBand": "100-1K", "contentAngle": "Offer free, customizable calendar templates to simplify content planning and publishing."}, {"intent": "informational", "keyword": "content marketing vs social media marketing", "difficulty": 36, "volumeBand": "100-1K", "contentAngle": "Comparative articles helping businesses decide where to focus resources for maximum impact."}, {"intent": "commercial", "keyword": "content marketing pricing", "difficulty": 41, "volumeBand": "100-1K", "contentAngle": "Detailed breakdowns of pricing models to inform buyers budgeting for content marketing help."}, {"intent": "commercial", "keyword": "content marketing automation software", "difficulty": 54, "volumeBand": "100-1K", "contentAngle": "Comparative lists and reviews of automation tools that make content marketing processes more efficient."}, {"intent": "informational", "keyword": "content marketing for ecommerce", "difficulty": 34, "volumeBand": "100-1K", "contentAngle": "Tailored strategies and tactics to help ecommerce store owners attract leads with effective content."}, {"intent": "commercial", "keyword": "content marketing consultant", "difficulty": 48, "volumeBand": "100-1K", "contentAngle": "Service and profile pages targeting businesses seeking freelance or agency consultation."}, {"intent": "informational", "keyword": "how to measure content marketing roi", "difficulty": 43, "volumeBand": "100-1K", "contentAngle": "Step-by-step guides breaking down key metrics and analytics for measuring content marketing results."}, {"intent": "informational", "keyword": "content marketing for SaaS", "difficulty": 35, "volumeBand": "100-1K", "contentAngle": "Best practices and examples tailored to SaaS companies to attract and retain users via content."}, {"intent": "commercial", "keyword": "content marketing packages", "difficulty": 46, "volumeBand": "100-1K", "contentAngle": "Commercial pages and comparison tables outlining different service package options for buyers."}, {"intent": "informational", "keyword": "types of content marketing", "difficulty": 57, "volumeBand": "1K-10K", "contentAngle": "Educational posts categorizing different content formats and their use cases for businesses."}, {"intent": "informational", "keyword": "content marketing trends 2024", "difficulty": 27, "volumeBand": "100-1K", "contentAngle": "Fresh, up-to-date content highlighting the newest trends, technologies, and shifts in content marketing."}]	2026-05-01 07:23:18.078488+00
2	1	\N	content marketing tips for startups	[{"intent": "informational", "keyword": "startup content strategy", "difficulty": 57, "volumeBand": "1K-10K", "contentAngle": "Guides and framework posts explaining how startups can plan and execute effective content strategies are popular because startups need clear, actionable steps."}, {"intent": "informational", "keyword": "content marketing for small businesses", "difficulty": 64, "volumeBand": "1K-10K", "contentAngle": "Comprehensive blog posts with step-by-step instructions and examples; valuable since small businesses seek low-cost, practical marketing tactics."}, {"intent": "commercial", "keyword": "best content tools for startups", "difficulty": 32, "volumeBand": "100-1K", "contentAngle": "Tool roundups and reviews listing essential content marketing software for startups are valuable for founders seeking to speed up marketing on a budget."}, {"intent": "transactional", "keyword": "content marketing packages for startups", "difficulty": 22, "volumeBand": "<100", "contentAngle": "Service page listings and pricing comparisons from agencies targeting startups looking to outsource content marketing affordably."}, {"intent": "informational", "keyword": "how to create content plan for startups", "difficulty": 28, "volumeBand": "100-1K", "contentAngle": "Step-by-step guides, templates, and checklists that help startup founders build a content plan are highly sought after for practical use."}, {"intent": "informational", "keyword": "content marketing examples for startups", "difficulty": 45, "volumeBand": "100-1K", "contentAngle": "Case study articles showcasing successful content marketing from real startups make valuable reference points for new businesses."}, {"intent": "informational", "keyword": "b2b content marketing for startups", "difficulty": 38, "volumeBand": "100-1K", "contentAngle": "Niche advice and breakdowns of B2B-focused content strategies and channels help startups targeting businesses in their growth stage."}, {"intent": "commercial", "keyword": "affordable content marketing services", "difficulty": 50, "volumeBand": "1K-10K", "contentAngle": "Listings and reviews of budget-friendly agencies or freelancers; valuable for founders looking to maximize ROI."}, {"intent": "transactional", "keyword": "content marketing audit for startups", "difficulty": 17, "volumeBand": "<100", "contentAngle": "Service offerings and templates that allow startups to self-assess and improve their content marketing performance."}, {"intent": "informational", "keyword": "startup blog content ideas", "difficulty": 29, "volumeBand": "100-1K", "contentAngle": "Lists and inspiration posts with blog topic ideas tailored for startup audiences; useful for founders lacking creative inspiration."}, {"intent": "informational", "keyword": "content marketing mistakes startups", "difficulty": 41, "volumeBand": "100-1K", "contentAngle": "Educational articles outlining common errors with actionable tips for startups looking to avoid costly results."}, {"intent": "informational", "keyword": "saas content marketing strategy", "difficulty": 67, "volumeBand": "1K-10K", "contentAngle": "Deep guides and frameworks specifically for SaaS startups explaining tactics proven to drive user signups and leads."}, {"intent": "informational", "keyword": "startup website content tips", "difficulty": 26, "volumeBand": "100-1K", "contentAngle": "Quick-win guides with actionable advice for building conversion-focused website content; great for early stage startups needing best practices."}, {"intent": "transactional", "keyword": "hire content writer for startup", "difficulty": 31, "volumeBand": "100-1K", "contentAngle": "Service listings and advice articles about hiring freelance or agency writers, targeting founders ready to invest in content."}, {"intent": "informational", "keyword": "social media content for startups", "difficulty": 53, "volumeBand": "1K-10K", "contentAngle": "Lists, examples, and templates for creating engaging social media posts; valuable for startups looking for awareness and followers."}, {"intent": "informational", "keyword": "content marketing roi for startups", "difficulty": 37, "volumeBand": "100-1K", "contentAngle": "Analytical guides and calculators to help startups measure and track the ROI of their content marketing activities."}, {"intent": "informational", "keyword": "startup video content ideas", "difficulty": 18, "volumeBand": "<100", "contentAngle": "Template lists and inspiration posts for video topics geared towards startups entering video marketing."}, {"intent": "commercial", "keyword": "startup content marketing agency", "difficulty": 47, "volumeBand": "100-1K", "contentAngle": "Lists and reviews of agencies specializing in startup content marketing; useful for founders seeking niche expertise."}]	2026-05-01 07:27:47.070102+00
3	1	\N	seo tools for beginners	[{"intent": "informational", "keyword": "best free seo tools", "difficulty": 55, "volumeBand": "1K-10K", "contentAngle": "Listicle or comparison articles showcasing top free SEO tools for users with limited budgets."}, {"intent": "commercial", "keyword": "easy seo software", "difficulty": 40, "volumeBand": "100-1K", "contentAngle": "Review articles highlighting simple and user-friendly SEO software suitable for beginners."}, {"intent": "informational", "keyword": "basic seo checklist", "difficulty": 45, "volumeBand": "1K-10K", "contentAngle": "Detailed checklists or guides that walk beginners through fundamental SEO activities and tools."}, {"intent": "informational", "keyword": "how to use keyword planner", "difficulty": 35, "volumeBand": "1K-10K", "contentAngle": "Step-by-step tutorials explaining how Google Keyword Planner works and its importance for SEO beginners."}, {"intent": "commercial", "keyword": "affordable seo tools", "difficulty": 60, "volumeBand": "100-1K", "contentAngle": "Comparisons and recommendations focused on budget-friendly yet effective SEO tool options."}, {"intent": "commercial", "keyword": "beginner seo audit tools", "difficulty": 28, "volumeBand": "100-1K", "contentAngle": "Lists and reviews tailored to entry-level users seeking easy-to-use tools for website SEO audits."}, {"intent": "commercial", "keyword": "seo plugins for wordpress beginners", "difficulty": 48, "volumeBand": "100-1K", "contentAngle": "Plugin roundups specifically targeting new WordPress users to bolster their site's SEO."}, {"intent": "informational", "keyword": "on page seo basics", "difficulty": 36, "volumeBand": "100-1K", "contentAngle": "Beginner guides breaking down the fundamentals of on-page SEO and recommended starter tools."}, {"intent": "commercial", "keyword": "simple backlink checker", "difficulty": 24, "volumeBand": "100-1K", "contentAngle": "Product reviews or tutorial pages for easy-to-use backlink analysis tools suited for non-experts."}, {"intent": "commercial", "keyword": "seo reporting tools for small business", "difficulty": 33, "volumeBand": "100-1K", "contentAngle": "Comparative articles for SEO reporting tools with features and pricing that appeal to small business owners and beginners."}, {"intent": "informational", "keyword": "best seo chrome extensions", "difficulty": 52, "volumeBand": "1K-10K", "contentAngle": "List articles ranking top browser extensions that aid with SEO tasks for beginners and power users alike."}, {"intent": "informational", "keyword": "google search console tutorial", "difficulty": 38, "volumeBand": "1K-10K", "contentAngle": "Comprehensive beginner tutorials teaching users how to leverage Google Search Console for basic SEO."}, {"intent": "commercial", "keyword": "compare yoast and all in one seo", "difficulty": 50, "volumeBand": "100-1K", "contentAngle": "In-depth reviews comparing leading WordPress SEO plugins to guide beginners in making informed choices."}, {"intent": "commercial", "keyword": "keyword research tools for newbies", "difficulty": 20, "volumeBand": "100-1K", "contentAngle": "Guides focused on entry-level keyword research tools with simple interfaces and free versions."}, {"intent": "commercial", "keyword": "free site audit tools", "difficulty": 54, "volumeBand": "1K-10K", "contentAngle": "Ranked comparisons of available free tools for conducting comprehensive SEO site audits."}, {"intent": "commercial", "keyword": "best seo tools for students", "difficulty": 18, "volumeBand": "100-1K", "contentAngle": "Tool reviews and recommendations tailored to students learning SEO or managing small projects."}, {"intent": "informational", "keyword": "beginner guide to semrush", "difficulty": 47, "volumeBand": "100-1K", "contentAngle": "How-to content and walkthroughs helping first-time SEMrush users harness its SEO capabilities."}, {"intent": "commercial", "keyword": "cheap seo tools for startups", "difficulty": 26, "volumeBand": "100-1K", "contentAngle": "Lists and comparison guides centered on affordable SEO tools suitable for fledgling businesses."}]	2026-05-01 07:34:32.041598+00
\.


--
-- Data for Name: keywords; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.keywords (id, website_id, keyword, current_rank, search_volume, difficulty, status, notes, created_at, updated_at, cluster, intent) FROM stdin;
1	1	best protein powder	4	18000	72	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
2	1	morning workout routine	12	9500	45	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
3	1	weight loss tips for beginners	7	14200	60	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
4	1	yoga for flexibility	2	6800	38	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
5	1	healthy meal prep ideas	19	22000	55	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
6	2	best laptops 2025	9	35000	82	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
7	2	wireless earbuds review	5	28000	68	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
8	2	iPhone vs Android	14	42000	90	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
9	2	best budget gaming monitor	3	11000	55	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
10	3	small bedroom ideas	6	16500	48	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
11	3	modern living room decor	11	24000	62	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
12	3	kitchen renovation on a budget	8	13000	51	tracking	\N	2026-04-23 05:44:30.95576+00	2026-04-23 05:44:30.95576+00	\N	\N
13	1	test keyword rank monitoring	15	\N	\N	tracking		2026-04-24 13:11:24.857043+00	2026-04-24 13:11:24.857043+00	\N	\N
15	1	best free seo tools	\N	\N	55	tracking	\N	2026-05-01 07:35:03.963356+00	2026-05-01 07:35:03.963356+00	\N	\N
16	1	easy seo software	\N	\N	40	tracking	\N	2026-05-01 07:40:08.497814+00	2026-05-01 07:40:08.497814+00	\N	\N
17	1	best running shoes	5	3000	45	tracking	\N	2026-05-03 14:43:29.062037+00	2026-05-03 14:43:29.062037+00	\N	\N
18	1	nike air max review	12	1500	30	tracking	\N	2026-05-03 14:43:29.062037+00	2026-05-03 14:43:29.062037+00	\N	\N
19	1	marathon training plan	\N	800	25	tracking	\N	2026-05-03 14:43:29.062037+00	2026-05-03 14:43:29.062037+00	\N	\N
20	2	yoga for beginners	8	2000	\N	tracking	\N	2026-05-03 18:25:13.231604+00	2026-05-03 18:25:13.231604+00	\N	\N
21	2	meditation app	15	1200	\N	tracking	\N	2026-05-03 18:25:13.231604+00	2026-05-03 18:25:13.231604+00	\N	\N
22	2	yoga	8	2000	\N	tracking	\N	2026-05-03 18:30:33.400556+00	2026-05-03 18:30:33.400556+00	\N	\N
23	2	meditation	15	1200	\N	tracking	\N	2026-05-03 18:30:33.400556+00	2026-05-03 18:30:33.400556+00	\N	\N
\.


--
-- Data for Name: lead_forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_forms (id, website_id, name, fields_json, active, submission_count, created_at) FROM stdin;
1	1	Homepage Contact	[{"name": "name", "enabled": true, "required": true}, {"name": "email", "enabled": true, "required": true}, {"name": "phone", "enabled": false, "required": false}, {"name": "message", "enabled": true, "required": false}]	f	1	2026-04-28 08:24:35.516934+00
3	1	Message Required Form	[{"name": "name", "enabled": true, "required": true}, {"name": "email", "enabled": true, "required": true}, {"name": "message", "enabled": true, "required": true}]	t	2	2026-04-28 08:30:24.392747+00
4	1	Default Fields Form	[{"name": "name", "enabled": true, "required": true}, {"name": "email", "enabled": true, "required": true}, {"name": "phone", "enabled": false, "required": false}, {"name": "message", "enabled": false, "required": false}]	t	0	2026-04-28 08:35:07.790987+00
\.


--
-- Data for Name: lead_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_notes (id, lead_id, staff_user_id, author_name, body, pinned, created_at) FROM stdin;
1	12	1	admin	Form message: Interested in your services	f	2026-04-28 08:24:44.404+00
2	10	1	admin	Went with competitor	f	2026-04-23 05:45:15.871+00
3	2	1	admin	Interested in personal training program	f	2026-04-23 05:45:15.871+00
4	15	1	admin	Followed up via email	f	2026-05-01 18:30:00.672+00
5	13	1	admin	Form message: Hello there	f	2026-04-28 08:30:24.507+00
6	5	1	admin	Purchased through affiliate link	f	2026-04-23 05:45:15.871+00
7	8	1	admin	Hired for interior design consultation	f	2026-04-23 05:45:15.871+00
8	6	1	admin	B2B inquiry for bulk licenses	f	2026-04-23 05:45:15.871+00
9	4	1	admin	Newsletter subscriber	f	2026-04-23 05:45:15.871+00
10	1	1	admin	Signed up for premium fitness plan	f	2026-04-23 05:45:15.871+00
11	3	1	admin	Downloaded meal prep guide	f	2026-04-23 05:45:15.871+00
12	14	1	admin	[Form] I want to learn more	f	2026-04-28 08:32:48.295+00
13	9	1	admin	Inquired about renovation services	f	2026-04-23 05:45:15.871+00
14	7	1	admin	Came directly from review post	f	2026-04-23 05:45:15.871+00
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, website_id, campaign_id, name, email, phone, source, status, notes, value, created_at, updated_at, score, score_breakdown, company) FROM stdin;
5	2	3	Alex Rodriguez	alex.r@techcorp.com	+1 555-0105	paid	converted	Purchased through affiliate link	599.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.272+00	25	{"total": 25, "valuePoints": 15, "sourcePoints": 10, "statusPoints": 0, "recencyPoints": 0}	\N
6	2	3	Priya Patel	priya.p@startup.io	\N	paid	qualified	B2B inquiry for bulk licenses	299.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.276+00	50	{"total": 50, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 30, "recencyPoints": 0}	\N
7	2	\N	David Kim	david.k@gmail.com	+1 555-0107	direct	contacted	Came directly from review post	149.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.28+00	40	{"total": 40, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 20, "recencyPoints": 0}	\N
13	1	\N	John	john@test.com	\N	form	new	Form message: Hello there	\N	2026-04-28 08:30:24.507143+00	2026-05-01 18:33:57.307+00	20	{"total": 20, "valuePoints": 0, "sourcePoints": 0, "statusPoints": 10, "recencyPoints": 10}	\N
14	1	\N	Jane Doe	jane@test.com	\N	referral	new	[Form] I want to learn more	\N	2026-04-28 08:32:48.295+00	2026-05-01 18:33:57.31+00	30	{"total": 30, "valuePoints": 0, "sourcePoints": 10, "statusPoints": 10, "recencyPoints": 10}	\N
15	1	\N	Test Lead User	testlead@example.com	\N	organic	contacted	Followed up via email	\N	2026-05-01 18:30:00.672845+00	2026-05-01 18:33:57.232+00	40	{"total": 40, "valuePoints": 0, "sourcePoints": 10, "statusPoints": 20, "recencyPoints": 10}	\N
8	3	5	Lisa Thompson	lisa.t@home.com	+1 555-0108	social	converted	Hired for interior design consultation	499.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.282+00	20	{"total": 20, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 0, "recencyPoints": 0}	\N
12	1	\N	John Doe	john@example.com	\N	form	new	Form message: Interested in your services	\N	2026-04-28 08:24:44.404612+00	2026-05-01 18:33:57.288+00	20	{"total": 20, "valuePoints": 0, "sourcePoints": 0, "statusPoints": 10, "recencyPoints": 10}	\N
9	3	\N	Robert Martinez	r.martinez@email.com	\N	organic	new	Inquired about renovation services	199.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.293+00	30	{"total": 30, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 10, "recencyPoints": 0}	\N
10	3	5	Amanda Foster	a.foster@gmail.com	+1 555-0110	social	lost	Went with competitor	299.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.296+00	20	{"total": 20, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 0, "recencyPoints": 0}	\N
11	1	\N	Test Scoring Lead	\N	\N	paid	qualified		1500.00	2026-04-24 13:45:31.655348+00	2026-05-01 18:33:57.299+00	60	{"total": 60, "valuePoints": 20, "sourcePoints": 10, "statusPoints": 30, "recencyPoints": 0}	\N
1	1	1	Sarah Johnson	sarah.j@email.com	+1 555-0101	organic	converted	Signed up for premium fitness plan	299.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.303+00	20	{"total": 20, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 0, "recencyPoints": 0}	\N
2	1	2	Mike Chen	mike.chen@gmail.com	\N	social	qualified	Interested in personal training program	149.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.305+00	50	{"total": 50, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 30, "recencyPoints": 0}	\N
3	1	\N	Emma Davis	emma.d@outlook.com	+1 555-0103	organic	contacted	Downloaded meal prep guide	299.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.266+00	40	{"total": 40, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 20, "recencyPoints": 0}	\N
4	1	1	James Wilson	jwilson@email.com	\N	organic	new	Newsletter subscriber	149.00	2026-04-23 05:45:15.871244+00	2026-05-01 18:33:57.27+00	30	{"total": 30, "valuePoints": 10, "sourcePoints": 10, "statusPoints": 10, "recencyPoints": 0}	\N
\.


--
-- Data for Name: link_suggestions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.link_suggestions (id, website_id, source_page, target_page, anchor_text, reason, created_at) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_attempts (id, ip, attempts, last_attempt_at, locked_until) FROM stdin;
\.


--
-- Data for Name: media_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media_assets (id, website_id, campaign_id, url, type, prompt, aspect_ratio, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.oauth_tokens (id, staff_user_id, website_id, provider, access_token, refresh_token, expires_at, scopes, gsc_property_url, google_email, created_at, updated_at, ga4_property_id) FROM stdin;
\.


--
-- Data for Name: outreach_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.outreach_contacts (id, name, domain, email, type, status, date_sent, follow_up_date, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: page_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.page_views (id, path, referrer, ip_hash, user_agent, visitor_id, created_at, confirmed) FROM stdin;
1	/test	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0 Chrome	add48551592dc78db74ada5a4afc4986	2026-05-08 15:47:18.920404+00	f
2	/	https://c85f435f-bae5-48c9-845a-b5231ff680ee-00-1th7rkq44qcze.spock.replit.dev/	3b3e64ae25a500925f352338239c25d7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	04ba0e25ba9e5089048be5452410faaf	2026-05-08 15:55:01.095846+00	f
3	/x	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	e26937ad5bd99e2f6ab1af2fb80e9b5c	2026-05-08 15:55:43.62497+00	f
4	/report	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	f6cf8c91db407add0435c5be6bee783e	2026-05-08 15:58:28.187611+00	f
5	/test	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	d29da2de1943c325a28dc3c2ff21e4d0	2026-05-08 16:03:35.974678+00	f
6	/test	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	f2b46c47c9bf4a8787b533585307f305	2026-05-08 16:05:13.806832+00	f
7	/test	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	a6b3d3874b0939279278f14c0a3847cb	2026-05-08 16:07:06.349412+00	f
8	/test	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	545202f6fe9f2ece91fae982bda1a8f5	2026-05-08 16:09:43.249129+00	f
9	/x	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	9da6ed191923efd9ce792e0df487f468	2026-05-08 16:09:43.312312+00	f
10	/blog/post-1	http://x.test/blog/post-1	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	aa65164f5a24d9606598037634561d43	2026-05-08 16:12:01.389523+00	f
11	/x	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	b525876018ac0202138387917cf15a14	2026-05-08 16:12:01.470024+00	f
12	/x	\N	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	892b3f00f6c7920d793813f14e27ad67	2026-05-08 16:13:55.859524+00	f
13	/	https://c85f435f-bae5-48c9-845a-b5231ff680ee-00-1th7rkq44qcze.spock.replit.dev/__replco/workspace_iframe.html?initialPath=%2F&id=artifacts%2Fmarketing-hub	3b3e64ae25a500925f352338239c25d7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	04ba0e25ba9e5089048be5452410faaf	2026-05-09 06:33:16.381131+00	t
14	/	https://c85f435f-bae5-48c9-845a-b5231ff680ee-00-1th7rkq44qcze.spock.replit.dev/	3b3e64ae25a500925f352338239c25d7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	04ba0e25ba9e5089048be5452410faaf	2026-05-09 06:35:44.49762+00	t
\.


--
-- Data for Name: pagespeed_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pagespeed_results (id, website_id, strategy, performance_score, accessibility_score, best_practices_score, seo_score, lcp_ms, fcp_ms, cls_score, inp_ms, ttfb_ms, speed_index_ms, error, recorded_at) FROM stdin;
1	1	mobile	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	PageSpeed API error 429: {\n  "error": {\n    "code": 429,\n    "message": "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'pagespeedonline.googleapis.com' for consumer 'project_number:583797351490'.",\n    "errors": [\n      {\n        "message": "Quota exceeded for quota metric 'Queries' and li	2026-05-03 18:27:26.616516+00
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, url, alt, sort_order, created_at) FROM stdin;
1	1	https://example.com/a.jpg	\N	0	2026-05-08 14:02:44.348527+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, slug, description, short_description, price, brand_id, category, features, hero_image, active, created_at, updated_at, seo_title, seo_description) FROM stdin;
1	Widget Pro	widget-pro	A pro widget.	Pro	$99	1	Widgets	[{"key": "Color", "value": "Black"}]	\N	t	2026-05-08 14:02:44.34374+00	2026-05-08 14:02:44.34374+00	\N	\N
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promotions (id, kind, title, body, image_url, cta_label, cta_url, cta_color, audience, starts_at, ends_at, active, created_at, updated_at) FROM stdin;
1	banner	Spring Sale	20% off	\N	Shop	/products	#dc2626	all	2026-05-08 13:02:44+00	2026-05-15 14:02:44+00	t	2026-05-08 14:02:44.784586+00	2026-05-08 14:02:44.784586+00
2	banner	Members Only		\N	\N	/products	#2563eb	loggedIn	2026-05-08 14:04:58.112+00	\N	t	2026-05-08 14:04:58.113467+00	2026-05-08 14:04:58.113467+00
\.


--
-- Data for Name: security_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.security_events (id, user_id, actor_id, action, target, ip, user_agent, details, created_at) FROM stdin;
1	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": true}	2026-05-08 07:57:38.403189+00
2	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 07:59:48.009427+00
3	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 08:00:09.47812+00
4	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 08:02:58.555544+00
5	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 08:06:25.144248+00
6	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 11:51:10.75091+00
7	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 12:31:59.759974+00
8	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 12:32:16.338271+00
9	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 12:34:23.160898+00
10	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 14:02:11.920052+00
11	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 14:02:43.981438+00
12	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 14:04:58.006092+00
13	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 15:25:25.685753+00
14	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 15:26:07.692918+00
15	1	\N	login_success	admin	::1	curl/8.14.1	{"remember": false}	2026-05-08 15:33:51.195742+00
\.


--
-- Data for Name: seo_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seo_audits (id, website_id, score, issues_json, crawled_data, crawled_at) FROM stdin;
1	4	100	[]	{"url": "https://drfatehsingh.com", "lang": "en-IN", "title": "Dr. Fateh Singh MD | Physician Ghaziabad — Heart, Diabetes & Thyroid", "h1Tags": ["Dr. Fateh Singh — Senior Consultant Physician in Ghaziabad NCR"], "h2Tags": [], "h3Tags": [], "ogImage": "https://drfatehsingh.com/opengraph.webp", "ogTitle": "Dr. Fateh Singh MD | Physician Ghaziabad — Heart, Diabetes & Thyroid", "wordCount": 74, "robotsMeta": "index, follow", "hasViewport": true, "imagesTotal": 0, "schemaTypes": [], "titleLength": 68, "canonicalUrl": "https://drfatehsingh.com/", "hasCanonical": true, "externalLinks": 0, "imagesWithAlt": [], "internalLinks": 8, "ogDescription": "Senior Physician in Ghaziabad NCR with 22+ years treating Heart Disease, Diabetes & Thyroid disorders. Book appointment at Sahibabad or Vaishali clinic.", "metaDescription": "Dr. Fateh Singh MD — Senior Physician in Ghaziabad NCR. 22+ years in Heart Disease, Diabetes & Thyroid. Book appointment at Sahibabad or Vaishali.", "imagesMissingAlt": 0, "metaDescriptionLength": 146}	2026-04-27 09:57:48.837018+00
\.


--
-- Data for Name: sequence_enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sequence_enrollments (id, sequence_id, lead_id, current_step, next_send_at, completed_at, created_at) FROM stdin;
3	3	9	0	2026-04-28 07:33:36.872+00	\N	2026-04-28 07:33:36.873332+00
4	3	4	0	2026-04-28 07:33:36.872+00	\N	2026-04-28 07:33:36.873332+00
\.


--
-- Data for Name: sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sequences (id, name, trigger, steps_json, active, created_at) FROM stdin;
3	Test	{"type": "status", "value": "new"}	[{"body": "Hello", "subject": "Hi", "delayDays": -1}]	t	2026-04-28 07:33:36.756062+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, user_id, jti, device, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at) FROM stdin;
1	1	ad2f2a48-d6a9-4624-9e70-8e44e11c863c	Remembered browser	::1	curl/8.14.1	2026-05-08 07:57:38.398071+00	2026-05-08 07:57:38.618+00	2026-06-07 07:57:38.397+00	\N
2	1	d4bf66a8-1ce6-41bb-9c46-74acbe06c695	Browser session	::1	curl/8.14.1	2026-05-08 07:59:47.974163+00	2026-05-08 07:59:48.201+00	2026-05-09 07:59:47.973+00	\N
3	1	6391105a-9eaf-41e2-9662-020da56517c9	Browser session	::1	curl/8.14.1	2026-05-08 08:00:09.472444+00	2026-05-08 08:00:09.664+00	2026-05-09 08:00:09.471+00	\N
4	1	dea5c809-4abe-4a63-a207-74fced6ba3ab	Browser session	::1	curl/8.14.1	2026-05-08 08:02:58.550202+00	2026-05-08 08:02:58.733+00	2026-05-09 08:02:58.549+00	\N
5	1	c594aee1-ca7e-42ae-bcfc-9faec6e1d383	Browser session	::1	curl/8.14.1	2026-05-08 08:06:25.115125+00	2026-05-08 08:06:25.416+00	2026-05-09 08:06:25.114+00	\N
6	1	87ecacb1-5f19-4d08-90a4-0140aad65642	Browser session	::1	curl/8.14.1	2026-05-08 11:51:10.712703+00	2026-05-08 12:05:38.222+00	2026-05-09 11:51:10.711+00	\N
7	1	00a44406-80f4-4950-a16a-8450c8586993	Browser session	::1	curl/8.14.1	2026-05-08 12:31:59.725761+00	2026-05-08 12:31:59.826+00	2026-05-09 12:31:59.724+00	\N
8	1	abcaf930-71f8-42dd-98e2-2de10e409e05	Browser session	::1	curl/8.14.1	2026-05-08 12:32:16.333971+00	2026-05-08 12:32:16.521+00	2026-05-09 12:32:16.333+00	\N
9	1	6b30ea12-bbbe-46f9-b833-3b8fda9316d3	Browser session	::1	curl/8.14.1	2026-05-08 12:34:23.12711+00	2026-05-08 12:34:23.227+00	2026-05-09 12:34:23.125+00	\N
10	1	e85930c4-2134-4201-add7-ec2b61205768	Browser session	::1	curl/8.14.1	2026-05-08 14:02:11.883279+00	2026-05-08 14:02:12.241+00	2026-05-09 14:02:11.882+00	\N
11	1	ae7bd538-82c7-4534-b2ff-0c326f64eb36	Browser session	::1	curl/8.14.1	2026-05-08 14:02:43.873058+00	2026-05-08 14:02:44.173+00	2026-05-09 14:02:43.871+00	\N
12	1	a68841a3-9e1e-4077-9fff-db615fa15e0e	Browser session	::1	curl/8.14.1	2026-05-08 14:04:58.000588+00	2026-05-08 14:04:58.096+00	2026-05-09 14:04:57.999+00	\N
13	1	4c7c5196-d684-4653-a189-e15f5bbd2323	Browser session	::1	curl/8.14.1	2026-05-08 15:25:25.672891+00	2026-05-08 15:25:25.868+00	2026-05-09 15:25:25.672+00	\N
14	1	b9824b01-1a5a-4e7c-b4ee-ebfce2fc804e	Browser session	::1	curl/8.14.1	2026-05-08 15:26:07.661891+00	2026-05-08 15:26:07.754+00	2026-05-09 15:26:07.66+00	\N
15	1	9efd81af-8617-458b-ae10-561a582d4596	Browser session	::1	curl/8.14.1	2026-05-08 15:33:50.781302+00	2026-05-08 15:33:51.324+00	2026-05-09 15:33:50.78+00	\N
\.


--
-- Data for Name: site_audit_issues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.site_audit_issues (id, site_audit_id, page_url, issue_type, severity, description, recommendation) FROM stdin;
1	1	https://fitlifeblog.com	redirect	info	Page redirects to a different URL	Update internal links to point directly to the final destination URL.
2	2	https://fitlifeblog.com	redirect	info	Page redirects to a different URL	Update internal links to point directly to the final destination URL.
3	3	https://fitlifeblog.com	redirect	info	Page redirects to a different URL	Update internal links to point directly to the final destination URL.
4	4	https://fitlifeblog.com	redirect	info	Page redirects to a different URL	Update internal links to point directly to the final destination URL.
5	5	https://fitlifeblog.com	redirect	info	Page redirects to a different URL	Update internal links to point directly to the final destination URL.
\.


--
-- Data for Name: site_audit_pages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.site_audit_pages (id, site_audit_id, url, status_code, title, meta_description, h1, word_count, response_time_ms, issue_count, score, crawled_at) FROM stdin;
1	1	https://fitlifeblog.com	200	FitLifeBlog.com is for sale | HugeDomains	Get a new domain name for your startup. Quick and professional service. Seamless domain transfers.	FitLifeBlog.com	1161	1073	1	97	2026-05-01 08:12:43.007803+00
2	2	https://fitlifeblog.com	200	FitLifeBlog.com is for sale | HugeDomains	Get a new domain name for your startup. Quick and professional service. Seamless domain transfers.	FitLifeBlog.com	1161	237	1	97	2026-05-01 08:18:36.015533+00
3	3	https://fitlifeblog.com	200	FitLifeBlog.com is for sale | HugeDomains	Get a new domain name for your startup. Quick and professional service. Seamless domain transfers.	FitLifeBlog.com	1161	240	1	97	2026-05-01 08:26:30.939876+00
4	4	https://fitlifeblog.com	200	FitLifeBlog.com is for sale | HugeDomains	Get a new domain name for your startup. Quick and professional service. Seamless domain transfers.	FitLifeBlog.com	1161	166	1	97	2026-05-01 08:26:49.278478+00
5	5	https://fitlifeblog.com	200	FitLifeBlog.com is for sale | HugeDomains	Get a new domain name for your startup. Quick and professional service. Seamless domain transfers.	FitLifeBlog.com	1161	185	1	97	2026-05-01 08:31:38.626807+00
\.


--
-- Data for Name: site_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.site_audits (id, website_id, status, pages_found, pages_crawled, health_score, created_at, completed_at) FROM stdin;
1	1	complete	1	1	97	2026-05-01 08:12:40.618222+00	2026-05-01 08:12:43.018+00
2	1	complete	1	1	88	2026-05-01 08:18:35.214897+00	2026-05-01 08:18:36.055+00
3	1	complete	1	1	88	2026-05-01 08:26:30.303525+00	2026-05-01 08:26:30.957+00
4	1	complete	1	1	88	2026-05-01 08:26:48.886789+00	2026-05-01 08:26:49.301+00
5	1	complete	1	1	88	2026-05-01 08:31:38.110888+00	2026-05-01 08:31:38.64+00
\.


--
-- Data for Name: social_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.social_posts (id, website_id, campaign_id, platform, content, status, scheduled_at, published_at, media_url, created_at, updated_at) FROM stdin;
1	1	2	instagram	5 morning habits that changed my life! Start with just 10 minutes of movement and see the difference. Which habit resonates most with you? #FitLife #MorningRoutine #HealthyLiving	published	\N	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
2	1	\N	facebook	New blog post: The Ultimate Guide to Meal Prep for Beginners. Save time, eat healthier, and stay on track with your fitness goals. Link in bio!	published	\N	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
3	1	2	instagram	Protein timing matters more than you think! Post-workout window: aim for 20-40g within 2 hours.	scheduled	2026-04-25 05:45:32.858511+00	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
4	2	3	twitter	Just tested the new MacBook Pro M4 for 30 days. Our full review drops tomorrow. Spoiler: the battery life will blow your mind.	scheduled	2026-04-24 05:45:32.858511+00	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
5	2	\N	linkedin	The wireless earbuds market is getting crowded. After testing 12 models, here are the ones that actually deliver.	draft	\N	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
6	3	5	instagram	Transform your small bedroom with these 7 space-saving tricks! #HomeDecor #InteriorDesign #SmallSpaces	published	\N	\N	\N	2026-04-23 05:45:32.858511+00	2026-04-23 05:45:32.858511+00
\.


--
-- Data for Name: staff_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_users (id, username, password_hash, role, created_at, permissions, plan, email, byok_provider, byok_api_key, byok_enabled, home_dir) FROM stdin;
1	admin	$2b$10$oA.ge7LAY0Jeirg/czLPvOl/z9h8Fw2CWNyQxCXOuiBZXuSdi7ZO2	admin	2026-04-24 05:30:27.496855+00	null	starter	\N	\N	\N	f	\N
\.


--
-- Data for Name: utm_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.utm_links (id, destination_url, source, medium, campaign, term, content, label, clicks, created_at, updated_at, website_id) FROM stdin;
\.


--
-- Data for Name: visitor_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.visitor_sessions (visitor_id, first_seen_at, last_seen_at, ip_hash, user_agent, heartbeat_at) FROM stdin;
add48551592dc78db74ada5a4afc4986	2026-05-08 15:47:19.009788+00	2026-05-08 15:47:19.009788+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0 Chrome	\N
1b42d75c5583e303b81e49d87c8cf754	2026-05-08 15:47:19.067998+00	2026-05-08 15:47:19.067998+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0 Chrome	\N
e26937ad5bd99e2f6ab1af2fb80e9b5c	2026-05-08 15:55:43.666457+00	2026-05-08 15:55:43.666457+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
6d3bacdec37fba6300a7e020d0d918c9	2026-05-08 15:55:43.716759+00	2026-05-08 15:55:43.716759+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
f6cf8c91db407add0435c5be6bee783e	2026-05-08 15:58:28.219933+00	2026-05-08 15:58:28.219933+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
26fc1ff290ebc509dac69f8fd3157c27	2026-05-08 15:58:28.261022+00	2026-05-08 15:58:28.261022+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
d29da2de1943c325a28dc3c2ff21e4d0	2026-05-08 16:03:35.985659+00	2026-05-08 16:03:35.985659+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
f2b46c47c9bf4a8787b533585307f305	2026-05-08 16:05:13.812167+00	2026-05-08 16:05:13.812167+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
a6b3d3874b0939279278f14c0a3847cb	2026-05-08 16:07:06.604792+00	2026-05-08 16:07:06.604792+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
545202f6fe9f2ece91fae982bda1a8f5	2026-05-08 16:09:43.253675+00	2026-05-08 16:09:43.253675+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
9da6ed191923efd9ce792e0df487f468	2026-05-08 16:09:43.315767+00	2026-05-08 16:09:43.315767+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
aa65164f5a24d9606598037634561d43	2026-05-08 16:12:01.423357+00	2026-05-08 16:12:01.423357+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
b525876018ac0202138387917cf15a14	2026-05-08 16:12:01.473441+00	2026-05-08 16:12:01.473441+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
892b3f00f6c7920d793813f14e27ad67	2026-05-08 16:13:56.066259+00	2026-05-08 16:13:56.066259+00	f04ab54eff8c8cc2164fc53f94a6b584	Mozilla/5.0	\N
04ba0e25ba9e5089048be5452410faaf	2026-05-08 15:55:01.103143+00	2026-05-10 05:20:36.089+00	3b3e64ae25a500925f352338239c25d7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-10 05:20:36.089+00
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_events (id, provider, event_type, event_id, status, payload, error, received_at) FROM stdin;
\.


--
-- Data for Name: websites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.websites (id, name, url, niche, seo_score, status, notes, created_at, updated_at, public_share_token) FROM stdin;
3	HomeDecor Ideas	https://homedecorideas.net	Home & Garden	52	active	Interior design tips and home improvement guides	2026-04-23 05:44:12.228014+00	2026-04-23 05:44:12.228014+00	\N
4	drfatehsingh	https://drfatehsingh.com	Health and consultant	100	active		2026-04-23 09:12:22.617991+00	2026-04-27 09:57:48.937+00	\N
1	FitLife Blog	https://fitlifeblog.com	Health & Fitness	78	active	Main health blog targeting fitness enthusiasts	2026-04-23 05:44:12.228014+00	2026-05-03 14:44:09.693+00	165d2e9d7857cf6ee9854d6b1f993a8982ef0729c6ff5bbe
2	TechReview Pro	https://techreviewpro.io	Technology	65	active	In-depth tech product reviews and comparisons	2026-04-23 05:44:12.228014+00	2026-05-03 18:32:01.812+00	2cc0bfa16e532e8c6954855ed93a5a20fa5ef2bc5b901887
\.


--
-- Name: ab_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ab_tests_id_seq', 4, true);


--
-- Name: ab_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ab_variants_id_seq', 8, true);


--
-- Name: ai_usage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_usage_id_seq', 21, true);


--
-- Name: app_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.app_settings_id_seq', 79, true);


--
-- Name: backlinks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.backlinks_id_seq', 9, true);


--
-- Name: blog_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.blog_posts_id_seq', 7, true);


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 1, true);


--
-- Name: campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.campaigns_id_seq', 5, true);


--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chatbot_conversations_id_seq', 3, true);


--
-- Name: client_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_reports_id_seq', 2, true);


--
-- Name: competitor_analyses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competitor_analyses_id_seq', 5, true);


--
-- Name: competitor_research_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competitor_research_sessions_id_seq', 2, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coupons_id_seq', 1, true);


--
-- Name: email_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_templates_id_seq', 2, true);


--
-- Name: ga4_cache_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ga4_cache_id_seq', 1, false);


--
-- Name: gallery_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gallery_images_id_seq', 2, true);


--
-- Name: gsc_cache_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gsc_cache_id_seq', 1, false);


--
-- Name: health_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.health_snapshots_id_seq', 1, false);


--
-- Name: ip_allowlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ip_allowlist_id_seq', 1, false);


--
-- Name: ip_rate_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ip_rate_limits_id_seq', 6, true);


--
-- Name: kb_articles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kb_articles_id_seq', 1, false);


--
-- Name: keyword_rank_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.keyword_rank_history_id_seq', 79, true);


--
-- Name: keyword_research_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.keyword_research_sessions_id_seq', 3, true);


--
-- Name: keywords_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.keywords_id_seq', 23, true);


--
-- Name: lead_forms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_forms_id_seq', 4, true);


--
-- Name: lead_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_notes_id_seq', 14, true);


--
-- Name: leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leads_id_seq', 15, true);


--
-- Name: link_suggestions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.link_suggestions_id_seq', 1, false);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 24, true);


--
-- Name: media_assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.media_assets_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, true);


--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.oauth_tokens_id_seq', 1, false);


--
-- Name: outreach_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.outreach_contacts_id_seq', 1, true);


--
-- Name: page_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.page_views_id_seq', 14, true);


--
-- Name: pagespeed_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pagespeed_results_id_seq', 1, true);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_images_id_seq', 1, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 1, true);


--
-- Name: promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.promotions_id_seq', 2, true);


--
-- Name: security_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.security_events_id_seq', 15, true);


--
-- Name: seo_audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seo_audits_id_seq', 1, true);


--
-- Name: sequence_enrollments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sequence_enrollments_id_seq', 16, true);


--
-- Name: sequences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sequences_id_seq', 17, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sessions_id_seq', 15, true);


--
-- Name: site_audit_issues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.site_audit_issues_id_seq', 5, true);


--
-- Name: site_audit_pages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.site_audit_pages_id_seq', 5, true);


--
-- Name: site_audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.site_audits_id_seq', 5, true);


--
-- Name: social_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.social_posts_id_seq', 6, true);


--
-- Name: staff_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.staff_users_id_seq', 10, true);


--
-- Name: utm_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.utm_links_id_seq', 2, true);


--
-- Name: webhook_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.webhook_events_id_seq', 1, false);


--
-- Name: websites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.websites_id_seq', 4, true);


--
-- Name: ab_tests ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_tests
    ADD CONSTRAINT ab_tests_pkey PRIMARY KEY (id);


--
-- Name: ab_variants ab_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_variants
    ADD CONSTRAINT ab_variants_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_user_type_month; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_type_month UNIQUE (user_id, type, year_month);


--
-- Name: app_settings app_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_unique UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: backlinks backlinks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlinks
    ADD CONSTRAINT backlinks_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_unique UNIQUE (slug);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: brands brands_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_slug_key UNIQUE (slug);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: chatbot_conversations chatbot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_pkey PRIMARY KEY (id);


--
-- Name: client_reports client_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_pkey PRIMARY KEY (id);


--
-- Name: client_reports client_reports_share_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_share_token_unique UNIQUE (share_token);


--
-- Name: competitor_analyses competitor_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_analyses
    ADD CONSTRAINT competitor_analyses_pkey PRIMARY KEY (id);


--
-- Name: competitor_research_sessions competitor_research_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_research_sessions
    ADD CONSTRAINT competitor_research_sessions_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: ga4_cache ga4_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ga4_cache
    ADD CONSTRAINT ga4_cache_pkey PRIMARY KEY (id);


--
-- Name: gallery_images gallery_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_pkey PRIMARY KEY (id);


--
-- Name: gsc_cache gsc_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gsc_cache
    ADD CONSTRAINT gsc_cache_pkey PRIMARY KEY (id);


--
-- Name: health_snapshots health_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.health_snapshots
    ADD CONSTRAINT health_snapshots_pkey PRIMARY KEY (id);


--
-- Name: ip_allowlist ip_allowlist_ip_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_allowlist
    ADD CONSTRAINT ip_allowlist_ip_unique UNIQUE (ip);


--
-- Name: ip_allowlist ip_allowlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_allowlist
    ADD CONSTRAINT ip_allowlist_pkey PRIMARY KEY (id);


--
-- Name: ip_rate_limits ip_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_rate_limits
    ADD CONSTRAINT ip_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: kb_articles kb_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);


--
-- Name: kb_articles kb_articles_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_slug_unique UNIQUE (slug);


--
-- Name: keyword_rank_history keyword_rank_history_keyword_date_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_rank_history
    ADD CONSTRAINT keyword_rank_history_keyword_date_uniq UNIQUE (keyword_id, recorded_date);


--
-- Name: keyword_rank_history keyword_rank_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_rank_history
    ADD CONSTRAINT keyword_rank_history_pkey PRIMARY KEY (id);


--
-- Name: keyword_research_sessions keyword_research_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_research_sessions
    ADD CONSTRAINT keyword_research_sessions_pkey PRIMARY KEY (id);


--
-- Name: keywords keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keywords
    ADD CONSTRAINT keywords_pkey PRIMARY KEY (id);


--
-- Name: lead_forms lead_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_pkey PRIMARY KEY (id);


--
-- Name: lead_notes lead_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: link_suggestions link_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.link_suggestions
    ADD CONSTRAINT link_suggestions_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_ip_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_ip_key UNIQUE (ip);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: outreach_contacts outreach_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outreach_contacts
    ADD CONSTRAINT outreach_contacts_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: pagespeed_results pagespeed_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagespeed_results
    ADD CONSTRAINT pagespeed_results_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: seo_audits seo_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seo_audits
    ADD CONSTRAINT seo_audits_pkey PRIMARY KEY (id);


--
-- Name: sequence_enrollments sequence_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: sequences sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_jti_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_jti_key UNIQUE (jti);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: site_audit_issues site_audit_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_issues
    ADD CONSTRAINT site_audit_issues_pkey PRIMARY KEY (id);


--
-- Name: site_audit_pages site_audit_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_pages
    ADD CONSTRAINT site_audit_pages_pkey PRIMARY KEY (id);


--
-- Name: site_audits site_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audits
    ADD CONSTRAINT site_audits_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_username_unique UNIQUE (username);


--
-- Name: utm_links utm_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utm_links
    ADD CONSTRAINT utm_links_pkey PRIMARY KEY (id);


--
-- Name: visitor_sessions visitor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (visitor_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: websites websites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT websites_pkey PRIMARY KEY (id);


--
-- Name: websites websites_public_share_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT websites_public_share_token_key UNIQUE (public_share_token);


--
-- Name: ga4_cache_website_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ga4_cache_website_key ON public.ga4_cache USING btree (website_id, cache_key);


--
-- Name: health_snapshots_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX health_snapshots_created_at_idx ON public.health_snapshots USING btree (created_at);


--
-- Name: idx_chatbot_conv_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chatbot_conv_created ON public.chatbot_conversations USING btree (created_at DESC);


--
-- Name: idx_chatbot_conv_visitor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chatbot_conv_visitor ON public.chatbot_conversations USING btree (visitor_id);


--
-- Name: page_views_confirmed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_views_confirmed_idx ON public.page_views USING btree (confirmed);


--
-- Name: page_views_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_views_created_at_idx ON public.page_views USING btree (created_at);


--
-- Name: page_views_path_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_views_path_idx ON public.page_views USING btree (path);


--
-- Name: pagespeed_results_website_strategy_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pagespeed_results_website_strategy_idx ON public.pagespeed_results USING btree (website_id, strategy, recorded_at DESC);


--
-- Name: sec_events_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sec_events_action_idx ON public.security_events USING btree (action);


--
-- Name: sec_events_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sec_events_created_idx ON public.security_events USING btree (created_at DESC);


--
-- Name: sec_events_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sec_events_user_idx ON public.security_events USING btree (user_id);


--
-- Name: sequence_enrollments_sequence_lead_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sequence_enrollments_sequence_lead_unique ON public.sequence_enrollments USING btree (sequence_id, lead_id);


--
-- Name: sessions_jti_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_jti_idx ON public.sessions USING btree (jti);


--
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);


--
-- Name: staff_users_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX staff_users_email_unique ON public.staff_users USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: visitor_sessions_heartbeat_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX visitor_sessions_heartbeat_idx ON public.visitor_sessions USING btree (heartbeat_at);


--
-- Name: visitor_sessions_last_seen_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX visitor_sessions_last_seen_idx ON public.visitor_sessions USING btree (last_seen_at);


--
-- Name: ab_variants ab_variants_test_id_ab_tests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_variants
    ADD CONSTRAINT ab_variants_test_id_ab_tests_id_fk FOREIGN KEY (test_id) REFERENCES public.ab_tests(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_user_id_staff_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_staff_users_id_fk FOREIGN KEY (user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: backlinks backlinks_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlinks
    ADD CONSTRAINT backlinks_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: client_reports client_reports_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: competitor_analyses competitor_analyses_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_analyses
    ADD CONSTRAINT competitor_analyses_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: competitor_research_sessions competitor_research_sessions_staff_user_id_staff_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitor_research_sessions
    ADD CONSTRAINT competitor_research_sessions_staff_user_id_staff_users_id_fk FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: ga4_cache ga4_cache_website_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ga4_cache
    ADD CONSTRAINT ga4_cache_website_id_fkey FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: gsc_cache gsc_cache_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gsc_cache
    ADD CONSTRAINT gsc_cache_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: keyword_rank_history keyword_rank_history_keyword_id_keywords_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_rank_history
    ADD CONSTRAINT keyword_rank_history_keyword_id_keywords_id_fk FOREIGN KEY (keyword_id) REFERENCES public.keywords(id) ON DELETE CASCADE;


--
-- Name: keyword_research_sessions keyword_research_sessions_staff_user_id_staff_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_research_sessions
    ADD CONSTRAINT keyword_research_sessions_staff_user_id_staff_users_id_fk FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: keyword_research_sessions keyword_research_sessions_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keyword_research_sessions
    ADD CONSTRAINT keyword_research_sessions_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE SET NULL;


--
-- Name: keywords keywords_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keywords
    ADD CONSTRAINT keywords_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: lead_forms lead_forms_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: lead_notes lead_notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_notes lead_notes_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: leads leads_campaign_id_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_campaign_id_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: leads leads_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: link_suggestions link_suggestions_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.link_suggestions
    ADD CONSTRAINT link_suggestions_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_campaign_id_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_campaign_id_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: media_assets media_assets_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: oauth_tokens oauth_tokens_staff_user_id_staff_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_staff_user_id_staff_users_id_fk FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: oauth_tokens oauth_tokens_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: pagespeed_results pagespeed_results_website_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagespeed_results
    ADD CONSTRAINT pagespeed_results_website_id_fkey FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: security_events security_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: security_events security_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: seo_audits seo_audits_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seo_audits
    ADD CONSTRAINT seo_audits_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: sequence_enrollments sequence_enrollments_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: sequence_enrollments sequence_enrollments_sequence_id_sequences_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_sequence_id_sequences_id_fk FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: site_audit_issues site_audit_issues_site_audit_id_site_audits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_issues
    ADD CONSTRAINT site_audit_issues_site_audit_id_site_audits_id_fk FOREIGN KEY (site_audit_id) REFERENCES public.site_audits(id) ON DELETE CASCADE;


--
-- Name: site_audit_pages site_audit_pages_site_audit_id_site_audits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audit_pages
    ADD CONSTRAINT site_audit_pages_site_audit_id_site_audits_id_fk FOREIGN KEY (site_audit_id) REFERENCES public.site_audits(id) ON DELETE CASCADE;


--
-- Name: site_audits site_audits_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_audits
    ADD CONSTRAINT site_audits_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_campaign_id_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_campaign_id_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;


--
-- Name: utm_links utm_links_website_id_websites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utm_links
    ADD CONSTRAINT utm_links_website_id_websites_id_fk FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict sO5ee5uyPBLG3Kdrx3tMkJEZ9glbETKcdsfq7Puem3wdcup430rpSTHFgFb6jPJ

