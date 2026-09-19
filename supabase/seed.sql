-- Datos iniciales y de prueba (Mock Seed) para Selecció Valenciana Castelló Futbol

-- Equipos de la provincia de Castelló
INSERT INTO public.teams (id, name, club, field_name, address, city, province, latitude, longitude) VALUES
('11111111-1111-1111-1111-111111111111', 'CD Castellón Sub-16', 'Club Deportivo Castellón', 'Estadio Castalia / Gaetà Huguet', 'Carrer de la Penyagolosa, s/n', 'Castelló de la Plana', 'Castelló', 39.9958, -0.0401),
('22222222-2222-2222-2222-222222222222', 'Villarreal CF Cadete A', 'Villarreal CF', 'Ciudad Deportiva José Manuel Llaneza', 'Camí Miralcamp, s/n', 'Vila-real', 'Castelló', 39.9328, -0.1082),
('33333333-3333-3333-3333-333333333333', 'CD Roda Sub-16', 'CD Roda', 'Ciutat Esportiva Pamesa Ceràmica', 'Camí Fondo, s/n', 'Vila-real', 'Castelló', 39.9485, -0.0911),
('44444444-4444-4444-4444-444444444444', 'Primer Templo Castelló Sub-16', 'Primer Templo FC', 'Campo Municipal Chencho', 'Quadra de la Salera, s/n', 'Castelló de la Plana', 'Castelló', 39.9782, -0.0523),
('55555555-5555-5555-5555-555555555555', 'U.D. Vall de Uxó Cadete', 'U.D. Vall de Uxó', 'Estadio José Mangriñán', 'Av. Jaume I, s/n', 'La Vall d''Uixó', 'Castelló', 39.8242, -0.2312)
ON CONFLICT (id) DO NOTHING;

-- Jugadores de prueba (20 jugadores)
INSERT INTO public.players (id, first_name, last_name, birth_date, position, dominant_foot, team_id, jersey_number, status, city, sports_data, source, source_player_id) VALUES
('a1000000-0000-0000-0000-000000000001', 'Pau', 'Ribes Martí', '2010-04-12', 'Portero', 'Diestro', '11111111-1111-1111-1111-111111111111', 1, 'Preseleccionado', 'Castelló de la Plana', '{"matches_played": 18, "clean_sheets": 7, "minutes": 1440}', 'source_a_scraping', 'EXT-P-101'),
('a1000000-0000-0000-0000-000000000002', 'Marc', 'Beltrán Soler', '2010-02-18', 'Defensa Central', 'Diestro', '11111111-1111-1111-1111-111111111111', 4, 'Seleccionado', 'Castelló de la Plana', '{"matches_played": 20, "goals": 2, "minutes": 1600}', 'source_a_scraping', 'EXT-P-102'),
('a1000000-0000-0000-0000-000000000003', 'Adrià', 'Ferrer Gimeno', '2010-08-05', 'Lateral Izquierdo', 'Zurdo', '22222222-2222-2222-2222-222222222222', 3, 'Seleccionado', 'Vila-real', '{"matches_played": 19, "assists": 5, "minutes": 1520}', 'source_a_scraping', 'EXT-P-103'),
('a1000000-0000-0000-0000-000000000004', 'Lluc', 'Navarro Fuster', '2010-01-22', 'Mediocentro', 'Diestro', '22222222-2222-2222-2222-222222222222', 6, 'Seleccionado', 'Burriana', '{"matches_played": 21, "goals": 4, "assists": 8, "minutes": 1650}', 'source_a_scraping', 'EXT-P-104'),
('a1000000-0000-0000-0000-000000000005', 'Mateo', 'García Barberá', '2010-11-30', 'Extremo Derecho', 'Diestro', '33333333-3333-3333-3333-333333333333', 7, 'Preseleccionado', 'Onda', '{"matches_played": 17, "goals": 9, "assists": 4, "minutes": 1360}', 'source_a_scraping', 'EXT-P-105'),
('a1000000-0000-0000-0000-000000000006', 'Arnau', 'Vidal Puig', '2010-06-14', 'Delantero Centro', 'Diestro', '11111111-1111-1111-1111-111111111111', 9, 'Seleccionado', 'Benicàssim', '{"matches_played": 20, "goals": 15, "assists": 3, "minutes": 1580}', 'source_a_scraping', 'EXT-P-106'),
('a1000000-0000-0000-0000-000000000007', 'Hugo', 'Sancho Sales', '2010-09-03', 'Mediapunta', 'Zurdo', '22222222-2222-2222-2222-222222222222', 10, 'Observado', 'Vila-real', '{"matches_played": 15, "goals": 6, "assists": 6, "minutes": 1200}', 'source_a_scraping', 'EXT-P-107'),
('a1000000-0000-0000-0000-000000000008', 'Sergi', 'Mendoza Ramos', '2010-03-29', 'Lateral Derecho', 'Diestro', '44444444-4444-4444-4444-444444444444', 2, 'Candidato', 'Castelló de la Plana', '{"matches_played": 18, "assists": 3, "minutes": 1400}', 'source_a_scraping', 'EXT-P-108'),
('a1000000-0000-0000-0000-000000000009', 'Pol', 'Albiol Company', '2010-07-19', 'Defensa Central', 'Diestro', '33333333-3333-3333-3333-333333333333', 5, 'Preseleccionado', 'Almassora', '{"matches_played": 19, "goals": 1, "minutes": 1520}', 'source_a_scraping', 'EXT-P-109'),
('a1000000-0000-0000-0000-000000000010', 'Alexandre', 'Tena Soriano', '2010-05-11', 'Portero', 'Diestro', '22222222-2222-2222-2222-222222222222', 13, 'Seleccionado', 'Vila-real', '{"matches_played": 16, "clean_sheets": 8, "minutes": 1280}', 'source_a_scraping', 'EXT-P-110'),
('a1000000-0000-0000-0000-000000000011', 'Carles', 'Castelló Nebot', '2010-12-01', 'Pivote Defensivo', 'Diestro', '55555555-5555-5555-5555-555555555555', 8, 'Observado', 'La Vall d''Uixó', '{"matches_played": 17, "goals": 2, "minutes": 1390}', 'source_a_scraping', 'EXT-P-111'),
('a1000000-0000-0000-0000-000000000012', 'Gerard', 'Monferrer Font', '2010-08-25', 'Extremo Izquierdo', 'Zurdo', '11111111-1111-1111-1111-111111111111', 11, 'Preseleccionado', 'Castelló de la Plana', '{"matches_played": 19, "goals": 8, "assists": 7, "minutes": 1450}', 'source_a_scraping', 'EXT-P-112'),
('a1000000-0000-0000-0000-000000000013', 'Xavi', 'Pitarch Blanch', '2010-03-10', 'Mediocentro', 'Ambidextro', '44444444-4444-4444-4444-444444444444', 14, 'Lesionado', 'Nules', '{"matches_played": 12, "goals": 3, "minutes": 900}', 'source_a_scraping', 'EXT-P-113'),
('a1000000-0000-0000-0000-000000000014', 'Iker', 'Vicente Peris', '2010-10-15', 'Delantero Centro', 'Diestro', '55555555-5555-5555-5555-555555555555', 9, 'Observado', 'Segorbe', '{"matches_played": 18, "goals": 11, "minutes": 1420}', 'source_a_scraping', 'EXT-P-114'),
('a1000000-0000-0000-0000-000000000015', 'Joan', 'Badenes Roig', '2010-01-08', 'Defensa Central', 'Diestro', '22222222-2222-2222-2222-222222222222', 15, 'Preseleccionado', 'Vinaròs', '{"matches_played": 19, "goals": 1, "minutes": 1500}', 'source_a_scraping', 'EXT-P-115'),
('a1000000-0000-0000-0000-000000000016', 'Bernat', 'Querol Pons', '2010-06-20', 'Lateral Izquierdo', 'Zurdo', '33333333-3333-3333-3333-333333333333', 17, 'Candidato', 'Benicarló', '{"matches_played": 16, "assists": 2, "minutes": 1180}', 'source_a_scraping', 'EXT-P-116'),
('a1000000-0000-0000-0000-000000000017', 'Guillem', 'Escrig Mollar', '2010-04-02', 'Mediapunta', 'Diestro', '11111111-1111-1111-1111-111111111111', 18, 'Candidato', 'L''Alcora', '{"matches_played": 14, "goals": 4, "minutes": 1050}', 'source_a_scraping', 'EXT-P-117'),
('a1000000-0000-0000-0000-000000000018', 'Víctor', 'Sospedra Grau', '2010-09-17', 'Extremo Derecho', 'Diestro', '44444444-4444-4444-4444-444444444444', 19, 'Candidato', 'Peñíscola', '{"matches_played": 15, "goals": 5, "minutes": 1100}', 'source_a_scraping', 'EXT-P-118'),
('a1000000-0000-0000-0000-000000000019', 'David', 'Miralles Fortea', '2010-02-04', 'Portero', 'Diestro', '33333333-3333-3333-3333-333333333333', 25, 'Candidato', 'Oropesa del Mar', '{"matches_played": 12, "clean_sheets": 3, "minutes": 960}', 'source_a_scraping', 'EXT-P-119'),
('a1000000-0000-0000-0000-000000000020', 'Jan', 'Porcar Climent', '2010-11-12', 'Pivote Defensivo', 'Diestro', '11111111-1111-1111-1111-111111111111', 20, 'Preseleccionado', 'Castelló de la Plana', '{"matches_played": 17, "goals": 1, "minutes": 1300}', 'source_a_scraping', 'EXT-P-120')
ON CONFLICT (id) DO NOTHING;

-- Partidos de prueba
INSERT INTO public.matches (id, home_team_id, away_team_id, match_date, field_name, address, city, latitude, longitude, status, home_score, away_score) VALUES
('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NOW() + INTERVAL '2 days', 'Gaetà Huguet', 'Carrer de la Penyagolosa', 'Castelló de la Plana', 39.9958, -0.0401, 'Programado', NULL, NULL),
('b1000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', NOW() + INTERVAL '5 days', 'Pamesa Ceràmica', 'Camí Fondo', 'Vila-real', 39.9485, -0.0911, 'Programado', NULL, NULL),
('b1000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'José Mangriñán', 'Av. Jaume I', 'La Vall d''Uixó', 39.8242, -0.2312, 'Programado', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Convocatorias de prueba
INSERT INTO public.callups (id, title, date, location, address, status, notes) VALUES
('c1000000-0000-0000-0000-000000000001', 'I Convocatòria Selecció Castelló Sub-16', NOW() + INTERVAL '4 days', 'Instalaciones Chencho', 'Quadra de la Salera, Castelló', 'Planificada', 'Convocatoria de preparación para el Torneo Territorial Autonómico.'),
('c2000000-0000-0000-0000-000000000002', 'II Convocatòria Control Tàctic Sub-16', NOW() + INTERVAL '12 days', 'Ciudad Deportiva José Manuel Llaneza', 'Vila-real', 'Borrador', 'Sesión intensiva de trabajo defensivo y transiciones rápidas.')
ON CONFLICT (id) DO NOTHING;

-- Entrenamientos de prueba
INSERT INTO public.training_sessions (id, title, start_time, end_time, location, field_name, objective, description) VALUES
('d1000000-0000-0000-0000-000000000001', 'Entrenament Preparatori Fase Regional', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', 'Gaetà Huguet', 'Campo 1 Césped Natural', 'Presión alta y salida de balón desde el portero', 'Entrenamiento específico de automatismos y situaciones de juego real.')
ON CONFLICT (id) DO NOTHING;
