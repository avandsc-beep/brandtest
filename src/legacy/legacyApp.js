export function initLegacyApp() {
/* =========================================================
           BASE DE DATOS LOCAL (interina)
           Hoy vive en localStorage del navegador. Esto significa que
           créditos y sesión NO se comparten entre dispositivos, y el
           panel de administración solo alcanza usuarios registrados
           en este mismo navegador. Reemplazar por Supabase (Postgres
           + Auth) cuando esté configurado: las funciones loadDB/saveDB
           y loginWithGoogle son los puntos de reemplazo.
           ========================================================= */
        /* =========================================================
           Límites reales activados. El único que usa sin límite es
           quien tenga is_admin=true en la base de datos (columna
           protegida — no se puede activar desde el navegador). Si
           algún día necesitas liberar créditos para todos otra vez
           (ej. pruebas), pon esto en true temporalmente.
           ========================================================= */
        const TESTING_MODE = false;

        // ============ Conexión real a Supabase ============
        const SUPABASE_URL = 'https://pybgughzjqzgbbsfklwi.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_mpRmXAFo-DEIMSMloI_OOg_-RzelkR-';
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // db: solo datos locales/cosméticos (no créditos, no cuentas — eso vive en Supabase).
        let db = { introSeen: false, lastUser: null, typologyFeedback: [], diagnosticFeedback: [] };
        // currentUser: la fila de public.users del usuario autenticado (créditos, plan, whatsapp...).
        let currentUser = null;
        // true cuando se usa la app sin cuenta (invitado) — currentUser es un objeto
        // local temporal, nada se guarda en Supabase.
        let isGuest = false;

        function loadDB() {
            const saved = localStorage.getItem('brandtest_db');
            if (saved) db = Object.assign({ introSeen: false, lastUser: null, typologyFeedback: [], diagnosticFeedback: [] }, JSON.parse(saved));
        }
        function saveDB() { localStorage.setItem('brandtest_db', JSON.stringify(db)); }

        function openHowItWorks() { document.getElementById('howItWorksModal').classList.add('active'); }
        function toggleHeaderMenu() {
            const menu = document.getElementById('headerMenu');
            const toggle = document.getElementById('headerMenuToggle');
            const isOpen = menu.classList.toggle('open');
            document.getElementById('headerMenuBackdrop').classList.toggle('open', isOpen);
            document.body.classList.toggle('menu-open-lock', isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
        function closeHeaderMenu() {
            document.getElementById('headerMenu').classList.remove('open');
            document.getElementById('headerMenuBackdrop').classList.remove('open');
            document.body.classList.remove('menu-open-lock');
            document.getElementById('headerMenuToggle').setAttribute('aria-expanded', 'false');
        }
        function closeHowItWorks() {
            document.getElementById('howItWorksModal').classList.remove('active');
            db.introSeen = true;
            saveDB();
        }
        function openProfile() { document.getElementById('profileModal').classList.add('active'); renderDiagnosisHistory(); }

        async function renderDiagnosisHistory() {
            const container = document.getElementById('diagnosisHistoryList');
            container.textContent = 'Cargando…';
            const { data, error } = await supabaseClient
                .from('diagnosis_history')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) { container.textContent = 'No se pudo cargar el historial.'; return; }
            if (!data || !data.length) { container.textContent = 'Todavía no guardaste ningún diagnóstico.'; return; }
            container.innerHTML = data.map(h =>
                '<div class="history-item history-item-clickable" data-id="' + h.id + '">' + (h.brand_name || 'Marca sin nombre') + ' — '
                + (typologies[h.typology] ? typologies[h.typology].name : h.typology) + ' — '
                + h.overall_score + '% — ' + new Date(h.created_at).toLocaleDateString('es-BO')
                + '</div>'
            ).join('');
            container.querySelectorAll('.history-item-clickable').forEach(el => {
                el.addEventListener('click', () => viewHistoryEntry(el.dataset.id));
            });
        }

        // Vuelve a mostrar un diagnóstico guardado — antes el historial solo
        // era una lista de texto sin forma de volver a revisar el análisis
        // completo; ahora reconstruye la pantalla de resultados tal como
        // quedó guardada, imagen incluida.
        async function viewHistoryEntry(id) {
            const { data, error } = await supabaseClient.from('diagnosis_history').select('*').eq('id', id).single();
            if (error || !data || !data.results_json) { notify('No se pudo cargar este diagnóstico'); return; }
            const results = data.results_json;
            if (data.image_path) {
                const { data: signed } = await supabaseClient.storage.from('diagnosis-images').createSignedUrl(data.image_path, 300);
                results.imageUsed = signed ? signed.signedUrl : null;
            }
            excludedColorIndices = new Set();
            currentResults = results;
            closeProfile();
            displayResults(results);
            document.getElementById('resultsSection').classList.add('active');
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
            notify('Mostrando diagnóstico guardado');
        }

        // Capa 3 de la mejora de color: recalcula Reproducibilidad y el
        // puntaje general usando solo los colores que el usuario no marcó
        // como ajenos a la marca — sin volver a correr todo el análisis.

        // Simulación de daltonismo — aproximación con matrices Brettel/Viénot
        // aplicadas directo en sRGB (el mismo enfoque que usan la mayoría de
        // los simuladores web). No reemplaza una prueba clínica, pero es
        // matemática real y consistente, no una estimación al ojo.
        const colorblindMatrices = {
            protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
            deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
            tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]]
        };
        function simulateColorblind(rgb, type) {
            const m = colorblindMatrices[type];
            const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
            const clamp = v => Math.round(Math.max(0, Math.min(1, v)) * 255);
            return {
                r: clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b),
                g: clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b),
                b: clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b)
            };
        }
        function toggleColorblindSimulation() {
            const container = document.getElementById('colorblindSimulation');
            const btn = document.getElementById('colorblindToggleBtn');
            const isHidden = container.style.display === 'none';
            if (isHidden && currentResults) renderColorblindSimulation(currentResults.colors.palette);
            container.style.display = isHidden ? 'block' : 'none';
            btn.textContent = isHidden ? 'Ocultar simulación' : 'Simular daltonismo';
        }
        function renderColorblindSimulation(palette) {
            const container = document.getElementById('colorblindSimulation');
            const types = [
                { key: 'protanopia', label: 'Protanopia (rojo-verde)' },
                { key: 'deuteranopia', label: 'Deuteranopia (rojo-verde)' },
                { key: 'tritanopia', label: 'Tritanopia (azul-amarillo)' }
            ];
            container.innerHTML = types.map(t => {
                const swatches = palette.map(c => {
                    const sim = simulateColorblind(c.rgb, t.key);
                    const hex = '#' + [sim.r, sim.g, sim.b].map(v => v.toString(16).padStart(2, '0')).join('');
                    return '<div class="colorblind-swatch" style="background:' + hex + ';"></div>';
                }).join('');
                return '<div class="colorblind-row"><span class="colorblind-row-label">' + t.label + '</span><div class="colorblind-swatches">' + swatches + '</div></div>';
            }).join('') + '<p style="font-size:0.66rem; color:var(--text-muted); margin-top:0.4rem; text-transform:none;">Aproximación (matrices Brettel/Viénot) — no reemplaza una prueba clínica de daltonismo.</p>';
        }

        function recalculatePalette() {
            if (!currentResults) return;
            const d = currentResults.rawData;
            const total = currentResults.colors.palette.length;
            const effectiveCount = Math.max(1, total - excludedColorIndices.size);
            const colorPenalty = Math.max(0, effectiveCount - 2) * 7;
            const bnPenalty = d.contrast < 3 ? 15 : 0;
            const newScore = Math.round(Math.max(40, Math.min(98, 95 - colorPenalty - bnPenalty)));
            const excludedNote = excludedColorIndices.size
                ? ' (se excluyeron ' + excludedColorIndices.size + ' de ' + total + ' colores detectados, marcados como ajenos a la marca).'
                : '';
            currentResults.indicators.reproducibilidad = {
                score: newScore,
                justification: "La marca trabaja con " + effectiveCount + " color(es) en su paleta efectiva" + excludedNote + " " +
                    (d.contrast >= 4.5
                        ? "El contraste entre fondo y tinta (" + d.contrast.toFixed(1) + ":1) es lo bastante alto como para sostener una reducción a escala de grises o a una sola tinta sin perder la figura."
                        : "El contraste entre fondo y tinta (" + d.contrast.toFixed(1) + ":1) es ajustado; conviene verificar que la marca no pierda presencia al reducirse a escala de grises o a una sola tinta.")
            };
            currentResults.colors.classification = classifyColors(effectiveCount) + (excludedColorIndices.size ? ' — paleta curada manualmente' : '');
            currentResults.overallScore = calculateOverall(currentResults.indicators);
            currentResults.diagnostic = generateDiagnostic(currentResults.typology, currentResults.indicators, d, currentResults.plan, currentResults.aiSummary);
            displayResults(currentResults);
            notify('Paleta recalculada — Reproducibilidad y puntaje general actualizados');
        }

        // Convierte currentResults en algo compacto para guardar — deja
        // afuera datos pesados que no hacen falta para volver a mostrar el
        // informe (como la lista completa de componentes detectados),
        // conservando lo mínimo de rawData que sí se usa (ej. contrast,
        // para poder recalcular la paleta incluso sobre un diagnóstico
        // histórico).
        function buildSerializableResults(results) {
            return {
                typology: results.typology,
                colors: results.colors,
                indicators: results.indicators,
                overallScore: results.overallScore,
                aiSummary: results.aiSummary || null,
                diagnostic: results.diagnostic,
                plan: results.plan,
                brandNameUsed: results.brandNameUsed,
                analyzedAt: results.analyzedAt,
                rawData: {
                    contrast: results.rawData.contrast,
                    symmetryScore: results.rawData.symmetryScore,
                    edgeComplexity: results.rawData.edgeComplexity,
                    componentCount: results.rawData.componentCount,
                    effectiveComponentCount: results.rawData.effectiveComponentCount,
                    colorCount: results.rawData.colorCount,
                    inkRatio: results.rawData.inkRatio,
                    W: results.rawData.W, H: results.rawData.H
                }
            };
        }

        async function saveDiagnosisToHistory() {
            if (!currentResults) return;
            if (isGuest) { notify('Crea una cuenta gratis para guardar diagnósticos en tu historial'); return; }

            let imagePath = null;
            try {
                const imgSrc = currentResults.imageUsed;
                const match = imgSrc && imgSrc.match(/^data:([^;]+);base64,/);
                if (match) {
                    const mediaType = match[1];
                    const ext = mediaType.split('/')[1] || 'png';
                    const fileName = currentUser.id + '/' + Date.now() + '.' + ext;
                    const blob = await (await fetch(imgSrc)).blob();
                    const { error: uploadError } = await supabaseClient.storage.from('diagnosis-images').upload(fileName, blob, { contentType: mediaType });
                    if (!uploadError) imagePath = fileName;
                }
            } catch (e) { /* si falla subir la imagen, igual se guarda el resto del diagnóstico */ }

            const { error } = await supabaseClient.from('diagnosis_history').insert({
                user_id: currentUser.id,
                brand_name: currentResults.brandNameUsed || null,
                typology: currentResults.typology.type,
                overall_score: currentResults.overallScore,
                plan: currentResults.plan,
                results_json: buildSerializableResults(currentResults),
                image_path: imagePath
            });
            if (error) { notify('No se pudo guardar: ' + error.message); return; }
            notify('Guardado en tu historial');
            resetApp(true);
        }
        function closeProfile() { document.getElementById('profileModal').classList.remove('active'); }

        function getInitials(name) {
            if (!name) return '?';
            const parts = name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        // Personaliza la pantalla de login: si el navegador reconoce una
        // cuenta usada antes (db.lastUser, guardado al cerrar sesión),
        // muestra su avatar (iniciales) y su nombre en primera persona.
        // Esto es solo cosmético — la sesión real la maneja Supabase, y si
        // sigue activa ni siquiera se llega a ver esta pantalla.
        function renderLoginScreen() {
            const known = db.lastUser;
            const dot = document.getElementById('loginCenterDot');
            const avatar = document.getElementById('loginAvatar');
            const eyebrow = document.getElementById('loginEyebrow');
            const title = document.getElementById('loginTitle');
            const subtitle = document.getElementById('loginSubtitle');
            const mainBtn = document.getElementById('loginMainBtn');
            const switchWrap = document.getElementById('switchAccountWrap');
            const creditsNote = document.getElementById('loginCreditsNote');
            if (known && known.name) {
                dot.style.display = 'none';
                avatar.style.display = 'flex';
                avatar.textContent = getInitials(known.name);
                eyebrow.textContent = 'Bienvenido de nuevo';
                title.textContent = known.name;
                subtitle.textContent = known.email || 'Continúa donde lo dejaste';
                mainBtn.textContent = 'Continuar como ' + known.name.split(' ')[0];
                switchWrap.style.display = 'block';
                creditsNote.style.display = 'none';
            } else {
                dot.style.display = 'block';
                avatar.style.display = 'none';
                eyebrow.textContent = 'Instrumento de medición de marcas';
                title.textContent = 'Bienvenido a BrandTest';
                subtitle.textContent = 'Accede para comenzar a analizar marcas';
                mainBtn.textContent = 'Acceder con Google';
                switchWrap.style.display = 'none';
                creditsNote.style.display = 'block';
            }
        }

        function switchAccount(e) {
            e.preventDefault();
            db.lastUser = null;
            saveDB();
            renderLoginScreen();
        }

        // ============ Modo invitado (sin cuenta, 1 análisis cada 48h) ============
        // Solo puede rastrearse en este navegador (no hay cuenta ligada a nada);
        // borrar los datos del sitio reinicia el límite, igual que cualquier
        // otro límite basado en almacenamiento local de la app.
        function useAsGuest(e) {
            if (e) e.preventDefault();
            const last = localStorage.getItem('brandtest_guest_last_use');
            if (last) {
                const hoursSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
                if (hoursSince < 48) {
                    notify('Ya usaste tu análisis gratuito sin registro. Vuelve en ' + Math.ceil(48 - hoursSince) + ' horas, o crea una cuenta gratis para seguir usando la app ahora.');
                    return;
                }
            }
            isGuest = true;
            currentUser = { id: null, email: null, name: 'Invitado', whatsapp: null, credits: 0, plan: 'libre', last_free_analysis: null, total_analyses: 0, is_admin: false };
            showMainApp();
        }

        // ============ Autenticación real (Supabase + Google) ============
        async function loginWithGoogle() {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) notify('Error al iniciar sesión: ' + error.message);
            // El navegador redirige a Google y vuelve; initAuth()/onAuthStateChange
            // detectan la sesión automáticamente al regresar.
        }

        async function logout() {
            if (isGuest) {
                isGuest = false;
                currentUser = null;
                document.getElementById('loginScreen').style.display = 'flex';
                document.getElementById('mainApp').style.display = 'none';
                document.getElementById('userSection').style.display = 'none';
                renderLoginScreen();
                return;
            }
            if (currentUser) db.lastUser = { name: currentUser.name, email: currentUser.email };
            saveDB();
            await supabaseClient.auth.signOut();
        }

        // Trae (o crea, si el disparador de la base de datos aún no terminó)
        // la fila de public.users del usuario autenticado. Devuelve true si
        // es un registro recién creado, para mostrarle la bienvenida.
        async function loadUserProfile(authUser) {
            let { data } = await supabaseClient.from('users').select('*').eq('id', authUser.id).single();
            if (!data) {
                await new Promise(r => setTimeout(r, 900));
                ({ data } = await supabaseClient.from('users').select('*').eq('id', authUser.id).single());
            }
            const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;
            if (data) {
                currentUser = data;
                currentUser.avatar_url = avatarUrl;
                return (Date.now() - new Date(data.registration_date).getTime()) < 8000;
            }
            currentUser = { id: authUser.id, email: authUser.email, name: authUser.user_metadata?.full_name || authUser.email, whatsapp: null, credits: 10, plan: 'libre', last_free_analysis: null, total_analyses: 0, is_admin: false, avatar_url: avatarUrl };
            return true;
        }

        async function initAuth() {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                await loadUserProfile(session.user);
                showMainApp();
            } else {
                document.getElementById('loginScreen').style.display = 'flex';
                renderLoginScreen();
            }
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    const isNew = await loadUserProfile(session.user);
                    showMainApp();
                    if (isNew || !db.introSeen) openHowItWorks();
                } else if (event === 'SIGNED_OUT') {
                    currentUser = null;
                    document.getElementById('loginScreen').style.display = 'flex';
                    document.getElementById('mainApp').style.display = 'none';
                    document.getElementById('userSection').style.display = 'none';
                    renderLoginScreen();
                }
            });
        }

        function showMainApp() {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('userSection').style.display = 'flex';
            updateUserUI();
            document.getElementById('adminBtn').style.display = currentUser.is_admin ? 'inline-block' : 'none';
            document.getElementById('profileBtn').style.display = isGuest ? 'none' : 'inline-block';
            document.getElementById('planEstandarOption').disabled = isGuest;
            document.getElementById('planProOption').disabled = isGuest;
            document.getElementById('guestPlanNote').style.display = isGuest ? 'block' : 'none';
            if (isGuest) document.getElementById('planSelect').value = 'libre';
            const badge = document.getElementById('testingBadge');
            if (TESTING_MODE) {
                badge.textContent = 'Modo prueba — créditos liberados para todos';
                badge.style.display = 'inline-block';
            } else if (currentUser.is_admin) {
                badge.textContent = 'Cuenta admin — uso ilimitado';
                badge.style.display = 'inline-block';
            } else if (isGuest) {
                badge.textContent = 'Invitado — 1 análisis cada 48h';
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        // Códigos de país para el campo de WhatsApp — Bolivia primero por
        // contexto, seguido de los países más comunes entre quienes usarían
        // esta herramienta.
        // Sin emoji de bandera: su render es inconsistente entre sistemas
        // operativos (en Windows suele caer a texto plano tipo "BO"), lo que
        // rompía el ancho del selector. El código de discado va primero para
        // que sea lo primero visible aunque el selector quede angosto.
        const whatsappCountryCodes = [
            { code: '591', label: '+591 Bolivia' },
            { code: '54', label: '+54 Argentina' },
            { code: '55', label: '+55 Brasil' },
            { code: '56', label: '+56 Chile' },
            { code: '57', label: '+57 Colombia' },
            { code: '51', label: '+51 Perú' },
            { code: '598', label: '+598 Uruguay' },
            { code: '595', label: '+595 Paraguay' },
            { code: '593', label: '+593 Ecuador' },
            { code: '52', label: '+52 México' },
            { code: '34', label: '+34 España' },
            { code: '1', label: '+1 EE.UU./Canadá' }
        ];

        function renderWhatsappCountrySelect() {
            const select = document.getElementById('whatsappCountryCode');
            select.innerHTML = whatsappCountryCodes.map(c => '<option value="' + c.code + '">' + c.label + '</option>').join('');
        }

        // Separa un número guardado completo (ej. "59171234567") en código +
        // número local para poblar los dos campos. Si no reconoce el código,
        // deja el selector en el valor por defecto y muestra el número tal cual.
        function splitWhatsapp(full) {
            if (!full) return;
            const match = whatsappCountryCodes
                .slice().sort((a, b) => b.code.length - a.code.length)
                .find(c => full.startsWith(c.code));
            if (match) {
                document.getElementById('whatsappCountryCode').value = match.code;
                document.getElementById('userWhatsapp').value = full.slice(match.code.length);
            } else {
                document.getElementById('userWhatsapp').value = full;
            }
        }

        function updateUserUI() {
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userCredits').textContent = isGuest ? 'Sin cuenta' : (currentUser.credits + ' créditos');
            document.getElementById('userPlan').textContent = isGuest ? 'Plan: Libre (invitado)' : 'Plan: ' + currentUser.plan.charAt(0).toUpperCase() + currentUser.plan.slice(1);
            if (!isGuest && currentUser.whatsapp) splitWhatsapp(currentUser.whatsapp);
            const avatarImg = document.getElementById('userAvatar');
            if (!isGuest && currentUser.avatar_url) {
                avatarImg.src = currentUser.avatar_url;
                avatarImg.alt = currentUser.name;
                avatarImg.style.display = 'inline-block';
            } else {
                avatarImg.style.display = 'none';
            }
        }

        function openAdmin() {
            document.getElementById('adminPanel').classList.add('active');
            document.getElementById('mainApp').style.display = 'none';
            renderCreditHistory();
            renderCalibrationFeedback();
            renderCalibTypologyGrid();
            renderCalibrationSamples();
            renderAdminMetrics();
            loadPublicStatsToggle();
        }

        async function loadPublicStatsToggle() {
            const { data } = await supabaseClient.from('app_settings').select('show_public_stats').eq('id', 1).single();
            document.getElementById('publicStatsToggle').checked = data ? data.show_public_stats : false;
        }
        async function togglePublicStats(checked) {
            const { error } = await supabaseClient.from('app_settings').update({ show_public_stats: checked }).eq('id', 1);
            if (error) { notify('No se pudo actualizar: ' + error.message); return; }
            notify(checked ? 'Estadísticas públicas activadas' : 'Estadísticas públicas desactivadas');
        }
        function closeAdmin() {
            document.getElementById('adminPanel').classList.remove('active');
            document.getElementById('mainApp').style.display = 'block';
        }

        /* ---- Test de reconocimiento (cualquier usuario, +1 crédito) ---- */
        let currentRecognitionSample = null;

        async function startRecognitionTest() {
            if (isGuest) { notify('Crea una cuenta gratis para participar en el test de reconocimiento'); return; }
            const container = document.getElementById('recognitionContent');
            container.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted);">Cargando…</p>';
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) { notify('Tu sesión expiró — vuelve a entrar'); return; }
            try {
                const res = await fetch('/api/get-recognition-sample', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.access_token }
                });
                const data = await res.json();
                if (!res.ok) { container.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted);">' + (data.error || 'No se pudo cargar una muestra.') + '</p>'; return; }
                if (data.done) { container.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted);">' + data.message + '</p>'; return; }
                currentRecognitionSample = data.sampleId;
                renderRecognitionGuessUI(data.imageUrl);
            } catch (e) {
                container.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted);">Error de conexión: ' + e.message + '</p>';
            }
        }

        function renderRecognitionGuessUI(imageUrl) {
            const container = document.getElementById('recognitionContent');
            container.innerHTML = '<img src="' + imageUrl + '" alt="Marca a identificar" style="max-width:220px; max-height:220px; border-radius:8px; border:1px solid var(--border); display:block; margin-bottom:0.8rem;">'
                + '<div class="form-group"><label for="recognitionBrandGuess">¿Reconoces la marca? (opcional)</label><input type="text" class="form-input" id="recognitionBrandGuess" placeholder="Nombre de la marca"></div>'
                + '<p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">¿Qué tipología es esta marca?</p>'
                + '<div class="typology-select-grid" id="recognitionTypologyGrid"></div>'
                + '<button class="btn btn-primary" id="recognitionSubmitBtn" style="width:100%; margin-top:0.8rem;">Enviar respuesta</button>';

            const grid = document.getElementById('recognitionTypologyGrid');
            grid.innerHTML = Object.keys(typologies).map(key =>
                '<div class="typology-select-card" data-type="' + key + '"><div class="tsc-name">' + typologies[key].name + '</div><div class="tsc-desc">' + typologies[key].description + '</div></div>'
            ).join('');
            grid.querySelectorAll('.typology-select-card').forEach(card => {
                card.addEventListener('click', () => {
                    grid.querySelectorAll('.typology-select-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
            document.getElementById('recognitionSubmitBtn').addEventListener('click', submitRecognitionAnswer);
        }

        async function submitRecognitionAnswer() {
            const selected = document.querySelector('#recognitionTypologyGrid .typology-select-card.selected');
            if (!selected) { notify('Selecciona una tipología'); return; }
            const brandGuess = document.getElementById('recognitionBrandGuess').value.trim();
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) { notify('Tu sesión expiró — vuelve a entrar'); return; }
            try {
                const res = await fetch('/api/submit-recognition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
                    body: JSON.stringify({ sampleId: currentRecognitionSample, answeredType: selected.dataset.type, answeredBrandName: brandGuess || null })
                });
                const data = await res.json();
                if (!res.ok) { notify(data.error || 'No se pudo enviar la respuesta'); return; }
                currentUser.credits = data.remainingCredits;
                updateUserUI();

                // Mecanismo educativo: no solo dice si acertó — muestra la
                // definición del tipo correcto siempre, y si falló, la
                // definición de lo que eligió al lado, para que la
                // diferencia quede clara, no solo el veredicto.
                const container = document.getElementById('recognitionContent');
                const resultColor = data.correct ? 'var(--cyan)' : 'var(--magenta)';
                const resultText = data.correct ? '¡Correcto!' : 'No exactamente';
                const correctT = typologies[data.correctType];
                const chosenT = typologies[selected.dataset.type];

                let html = '<p style="font-size:0.85rem; color:' + resultColor + '; font-weight:600;">' + resultText + '</p>';
                html += '<div class="note-box" style="margin-top:0.5rem;"><strong>' + correctT.name + ':</strong> ' + correctT.description + '</div>';
                if (!data.correct) {
                    html += '<div class="note-box" style="margin-top:0.5rem;"><strong>Tu respuesta (' + chosenT.name + '):</strong> ' + chosenT.description + '</div>';
                }
                if (data.notes) {
                    html += '<div class="note-box" style="margin-top:0.5rem;"><strong>Nota del evaluador:</strong> ' + data.notes + '</div>';
                }
                if (brandGuess && data.correctBrandName) {
                    const brandCorrect = brandGuess.toLowerCase() === data.correctBrandName.toLowerCase();
                    html += '<p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">Marca real: <strong>' + data.correctBrandName + '</strong>' + (brandCorrect ? ' — ¡también acertaste el nombre!' : '') + '</p>';
                } else if (data.correctBrandName) {
                    html += '<p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">Marca: <strong>' + data.correctBrandName + '</strong></p>';
                }
                html += '<p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 0.8rem;">+1 crédito — saldo: ' + data.remainingCredits + '</p>';
                html += '<button class="btn btn-accent" id="recognitionNextBtn">Otra marca</button>';
                container.innerHTML = html;
                document.getElementById('recognitionNextBtn').addEventListener('click', startRecognitionTest);
            } catch (e) {
                notify('Error de conexión: ' + e.message);
            }
        }

        function switchAdminTab(tabName) {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
            document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('adminTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
        }

        // Panel de Métricas: salud general del proyecto — usuarios, créditos
        // otorgados vs. gastados, análisis realizados, y participación real
        // en el banco de calibración y el test de reconocimiento.
        async function renderAdminMetrics() {
            const container = document.getElementById('metricsGrid');
            container.textContent = 'Cargando…';
            try {
                const [usersRes, grantedRes, spentRes, diagRes, calibRes, recogRes] = await Promise.all([
                    supabaseClient.from('users').select('total_analyses', { count: 'exact' }),
                    supabaseClient.from('credit_history').select('amount'),
                    supabaseClient.from('credit_usage_log').select('amount'),
                    supabaseClient.from('diagnosis_history').select('id', { count: 'exact', head: true }),
                    supabaseClient.from('calibration_samples').select('id', { count: 'exact', head: true }),
                    supabaseClient.from('recognition_responses').select('correct')
                ]);
                const totalUsers = usersRes.count ?? (usersRes.data || []).length;
                const totalAnalyses = (usersRes.data || []).reduce((s, u) => s + (u.total_analyses || 0), 0);
                const creditsGranted = (grantedRes.data || []).reduce((s, r) => s + r.amount, 0);
                const creditsSpent = (spentRes.data || []).reduce((s, r) => s + r.amount, 0);
                const savedDiagnoses = diagRes.count ?? 0;
                const calibSamples = calibRes.count ?? 0;
                const recognitionTotal = (recogRes.data || []).length;
                const recognitionCorrect = (recogRes.data || []).filter(r => r.correct).length;
                const recognitionAccuracy = recognitionTotal ? Math.round((recognitionCorrect / recognitionTotal) * 100) : 0;

                const stats = [
                    { label: 'Usuarios registrados', value: totalUsers },
                    { label: 'Análisis realizados', value: totalAnalyses },
                    { label: 'Créditos otorgados', value: creditsGranted },
                    { label: 'Créditos gastados', value: creditsSpent },
                    { label: 'Diagnósticos guardados', value: savedDiagnoses },
                    { label: 'Muestras en banco de calibración', value: calibSamples },
                    { label: 'Respuestas en test de reconocimiento', value: recognitionTotal },
                    { label: 'Aciertos en test de reconocimiento', value: recognitionAccuracy + '%' }
                ];
                container.innerHTML = stats.map(s =>
                    '<div class="metric-stat-card"><div class="metric-stat-value">' + s.value + '</div><div class="metric-stat-label">' + s.label + '</div></div>'
                ).join('');
            } catch (e) {
                container.innerHTML = '<div class="history-item">No se pudieron cargar las métricas: ' + e.message + '</div>';
            }
        }

        /* ---- Banco de calibración (solo admin) ---- */
        let calibImageData = null;

        function renderCalibTypologyGrid() {
            const grid = document.getElementById('calibTypologyGrid');
            let html = '';
            Object.keys(typologies).forEach(key => {
                html += '<div class="typology-select-card" data-type="' + key + '"><div class="tsc-name">' + typologies[key].name + '</div><div class="tsc-desc">' + typologies[key].description + '</div></div>';
            });
            grid.innerHTML = html;
            grid.querySelectorAll('.typology-select-card').forEach(card => {
                card.addEventListener('click', () => {
                    grid.querySelectorAll('.typology-select-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
        }

        function handleCalibFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                calibImageData = e.target.result;
                document.getElementById('calibPreview').src = calibImageData;
                document.getElementById('calibPreviewWrap').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }

        async function saveCalibrationSample() {
            const selected = document.querySelector('#calibTypologyGrid .typology-select-card.selected');
            if (!calibImageData) { notify('Sube o toma una foto primero'); return; }
            if (!selected) { notify('Selecciona cuál es la tipología correcta'); return; }
            const type = selected.dataset.type;
            const brandName = document.getElementById('calibBrandName').value.trim();
            const notes = document.getElementById('calibNotes').value.trim();

            const match = calibImageData.match(/^data:([^;]+);base64,/);
            const mediaType = match ? match[1] : 'image/png';
            const ext = mediaType.split('/')[1] || 'png';
            const fileName = currentUser.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
            const blob = await (await fetch(calibImageData)).blob();

            const { error: uploadError } = await supabaseClient.storage
                .from('calibration-images')
                .upload(fileName, blob, { contentType: mediaType });
            if (uploadError) { notify('No se pudo subir la imagen: ' + uploadError.message); return; }

            const { error: insertError } = await supabaseClient.from('calibration_samples').insert({
                admin_id: currentUser.id,
                image_path: fileName,
                typology: type,
                brand_name: brandName || null,
                notes: notes || null,
                color_count_manual: Number(document.getElementById('calibColorCount').value),
                calidad_grafica_manual: Number(document.getElementById('calibCalidad').value),
                reproducibilidad_manual: Number(document.getElementById('calibRepro').value),
                legibilidad_manual: Number(document.getElementById('calibLegib').value),
                inteligibilidad_manual: Number(document.getElementById('calibIntel').value),
                vocatividad_manual: Number(document.getElementById('calibVoca').value),
                pregnancia_manual: Number(document.getElementById('calibPregnancia').value),
                overall_manual: Number(document.getElementById('calibOverall').value),
                confidence_manual: Number(document.getElementById('calibConfidence').value)
            });
            if (insertError) { notify('No se pudo guardar la muestra: ' + insertError.message); return; }

            notify('Muestra guardada en el banco de calibración');
            calibImageData = null;
            document.getElementById('calibPreviewWrap').style.display = 'none';
            document.getElementById('calibImageInput').value = '';
            document.getElementById('calibBrandName').value = '';
            document.getElementById('calibNotes').value = '';
            document.querySelectorAll('#calibTypologyGrid .typology-select-card').forEach(c => c.classList.remove('selected'));
            ['calibColorCount','calibCalidad','calibRepro','calibLegib','calibIntel','calibVoca','calibPregnancia','calibOverall'].forEach(id => {
                document.getElementById(id).value = 5;
                document.getElementById(id + 'Val').textContent = '5';
            });
            document.getElementById('calibConfidence').value = 3;
            document.getElementById('calibConfidenceVal').textContent = '3';
            renderCalibrationSamples();
        }

        async function renderCalibrationSamples() {
            const container = document.getElementById('calibList');
            const { data, error } = await supabaseClient.from('calibration_samples').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) { container.innerHTML = '<div class="history-item">No se pudo cargar el banco de calibración.</div>'; return; }
            if (!data || !data.length) { container.innerHTML = '<div class="history-item">Todavía no hay muestras guardadas.</div>'; return; }
            container.innerHTML = '<div class="history-item" style="color:var(--text);">' + data.length + ' muestra(s) guardada(s)</div>'
                + data.map(s => '<div class="history-item">' + (s.brand_name || 'Sin nombre') + ' — '
                    + (typologies[s.typology] ? typologies[s.typology].name : s.typology) + ' — '
                    + new Date(s.created_at).toLocaleDateString('es-BO') + '</div>').join('');
        }

        function renderCalibrationFeedback() {
            const typoContainer = document.getElementById('typologyFeedbackList');
            if (!db.typologyFeedback.length) {
                typoContainer.innerHTML = '<div class="history-item">Sin correcciones registradas todavía.</div>';
            } else {
                typoContainer.innerHTML = '';
                db.typologyFeedback.slice().reverse().forEach(entry => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.textContent = (typologies[entry.predicted] ? typologies[entry.predicted].name : entry.predicted)
                        + ' (predicho, ' + entry.predictedConfidence + '% confianza) → corregido a '
                        + (typologies[entry.corrected] ? typologies[entry.corrected].name : entry.corrected)
                        + ' — ' + new Date(entry.date).toLocaleString();
                    typoContainer.appendChild(div);
                });
            }
            const diagContainer = document.getElementById('diagnosticFeedbackList');
            if (!db.diagnosticFeedback.length) {
                diagContainer.innerHTML = '<div class="history-item">Sin opiniones registradas todavía.</div>';
            } else {
                const positives = db.diagnosticFeedback.filter(f => f.positive).length;
                const summary = document.createElement('div');
                summary.className = 'history-item';
                summary.style.color = 'var(--text)';
                summary.textContent = positives + ' de ' + db.diagnosticFeedback.length + ' opiniones positivas';
                diagContainer.innerHTML = '';
                diagContainer.appendChild(summary);
                db.diagnosticFeedback.slice().reverse().forEach(entry => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.textContent = (entry.positive ? 'Sí' : 'No') + ' — ' + (typologies[entry.typology] ? typologies[entry.typology].name : entry.typology)
                        + ', puntaje ' + entry.overallScore + '%, plan ' + entry.plan + ' — ' + new Date(entry.date).toLocaleString();
                    diagContainer.appendChild(div);
                });
            }
        }

        // Llama a la función de servidor (api/credit-user.js), que es la
        // única pieza con permiso real para editar créditos de otro usuario.
        // La contraseña de admin se pide una vez y se guarda solo para esta
        // pestaña (sessionStorage) — no queda guardada de forma permanente.
        async function acreditarCreditos(amount) {
            const whatsapp = document.getElementById('adminWhatsapp').value.trim();
            if (!whatsapp) { notify('Ingrese el número de WhatsApp'); return; }
            let adminSecret = sessionStorage.getItem('brandtest_admin_secret');
            if (!adminSecret) {
                adminSecret = prompt('Contraseña de administrador:');
                if (!adminSecret) return;
                sessionStorage.setItem('brandtest_admin_secret', adminSecret);
            }
            try {
                const res = await fetch('/api/credit-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ whatsapp, amount, adminSecret })
                });
                const result = await res.json();
                if (!res.ok) {
                    if (res.status === 401) sessionStorage.removeItem('brandtest_admin_secret');
                    notify('Error: ' + (result.error || 'no se pudo acreditar'));
                    return;
                }
                notify('+' + amount + ' créditos para ' + whatsapp + ' (saldo nuevo: ' + result.newCredits + ')');
                document.getElementById('adminWhatsapp').value = '';
                renderCreditHistory();
            } catch (err) {
                notify('Error de conexión con el servidor: ' + err.message);
            }
        }

        // Combina lo otorgado (credit_history) y lo gastado
        // (credit_usage_log) en un solo listado cronológico — antes esto
        // era un mensaje diciendo "revisa Supabase directamente"; ahora se
        // ve de verdad dentro de la app.
        async function renderCreditHistory() {
            const container = document.getElementById('creditHistory');
            container.textContent = 'Cargando…';
            try {
                const [grantedRes, spentRes, usersRes] = await Promise.all([
                    supabaseClient.from('credit_history').select('whatsapp, amount, created_at').order('created_at', { ascending: false }).limit(50),
                    supabaseClient.from('credit_usage_log').select('user_id, amount, plan, created_at').order('created_at', { ascending: false }).limit(50),
                    supabaseClient.from('users').select('id, name, email')
                ]);
                const userMap = {};
                (usersRes.data || []).forEach(u => { userMap[u.id] = u.name || u.email; });

                const entries = [];
                (grantedRes.data || []).forEach(g => entries.push({ type: 'otorgado', label: g.whatsapp, amount: g.amount, date: g.created_at }));
                (spentRes.data || []).forEach(s => entries.push({ type: 'gastado', label: userMap[s.user_id] || 'usuario', amount: s.amount, plan: s.plan, date: s.created_at }));
                entries.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (!entries.length) { container.innerHTML = '<div class="history-item">Sin movimientos todavía.</div>'; return; }
                container.innerHTML = entries.slice(0, 60).map(e => {
                    const sign = e.type === 'otorgado' ? '+' : '−';
                    const color = e.type === 'otorgado' ? 'var(--success)' : 'var(--text-muted)';
                    const detail = e.type === 'otorgado' ? e.label : (e.label + ' (' + e.plan + ')');
                    return '<div class="history-item" style="color:' + color + ';">' + sign + e.amount + ' — ' + detail + ' — ' + new Date(e.date).toLocaleString('es-BO') + '</div>';
                }).join('');
            } catch (e) {
                container.innerHTML = '<div class="history-item">No se pudo cargar el historial: ' + e.message + '</div>';
            }
        }

        async function saveWhatsapp() {
            const localNumber = document.getElementById('userWhatsapp').value.trim().replace(/\D/g, '');
            if (!localNumber) { notify('Ingresa tu número'); return; }
            const code = document.getElementById('whatsappCountryCode').value;
            const whatsapp = code + localNumber;
            const { error } = await supabaseClient.from('users').update({ whatsapp }).eq('id', currentUser.id);
            if (error) { notify('No se pudo guardar: ' + error.message); return; }
            currentUser.whatsapp = whatsapp;
            notify('WhatsApp guardado');
        }

        function solicitarCreditos() {
            const whatsapp = currentUser.whatsapp || document.getElementById('userWhatsapp').value.trim();
            if (!whatsapp) { notify('Primero guarda tu WhatsApp'); return; }
            const message = 'Hola Marco, solicito créditos para BrandTest. Mi número es ' + whatsapp;
            window.open('https://wa.me/59170857324?text=' + encodeURIComponent(message), '_blank');
        }

        let selectedImage = null;
        // Resultado real de aplicar brillo/contraste/saturación/rotación/balance
        // de blancos sobre selectedImage — esto es lo que se analiza (no el
        // original), para que el motor vea exactamente lo que el usuario corrigió.
        let adjustedImage = null;
        // De dónde vino la imagen ('camera' o 'upload') — el motor de color
        // usa esto para decidir qué tan agresivo ser fusionando colores
        // parecidos: una foto de cámara tiene ruido fotográfico real que
        // conviene absorber; un archivo subido normalmente ya es limpio
        // (un logo exportado), así que ahí conviene ser mucho más fiel al
        // conteo real de colores, sin de-facto "perdonar" tonos distintos.
        let imageSource = null;
        let cameraStream = null;
        let cropperInstance = null;
        let selectedTypologyOverride = null;
        let currentResults = null;
        // Índices de la paleta que el usuario marcó como ajenos a la marca
        // (ruido de foto, sombra, fondo) — no se borran del arreglo, solo se
        // excluyen del conteo que alimenta el puntaje.
        let excludedColorIndices = new Set();
        let correctedTypology = null;

        const evaluableIndicators = {
            calidad_grafica: { name: "Calidad Gráfica Genérica", category: 1, weight: 0.17, definition: "Competencia técnica en la ejecución del trazo: consistencia de grosores, limpieza de remates y calidad de las uniones entre formas.", criteria: ["Precisión en trazado", "Consistencia de grosores", "Alineación correcta", "Limpieza visual", "Calidad de uniones"] },
            reproducibilidad: { name: "Reproducibilidad", category: 1, weight: 0.17, definition: "Estabilidad del signo al reducirse de escala, pasar a monocromía o cambiar de soporte de impresión.", criteria: ["Legibilidad a 9px (7pt)", "Funciona en B/N", "Sin degradados problemáticos", "Paleta adecuada"] },
            legibilidad: { name: "Legibilidad", category: 3, weight: 0.17, definition: "Relación figura-fondo y contraste tonal que sostienen una lectura fluida del signo.", criteria: ["Contraste mínimo 4.5:1", "Tamaño adecuado", "Grosor correcto", "Espaciado adecuado", "Sin interferencias"] },
            inteligibilidad: { name: "Inteligibilidad", category: 3, weight: 0.17, definition: "Síntesis formal y relación ícono-referente que permiten decodificar el mensaje sin apoyo textual adicional.", criteria: ["Forma reconocible", "Relación ícono-referente", "Sin explicación adicional", "Mensaje claro"] },
            vocatividad: { name: "Vocatividad", category: 3, weight: 0.16, definition: "Peso visual y jerarquía perceptual del signo: su capacidad de captar la atención dentro de un campo visual competido.", criteria: ["Atención en <3 seg", "Contraste >30%", "Elemento distintivo", "Elemento principal ≥25%", "Colores de impacto"] },
            pregnancia: { name: "Pregnancia", category: 4, weight: 0.16, definition: "Cierre gestáltico y memorabilidad de la forma: cuán fácil resulta evocarla y reproducirla de memoria.", criteria: ["Descripción verbal simple", "1-2 elementos visuales", "Forma dominante clara", "Dibujable de memoria"] }
        };


        const categories = {
            1: { name: "Ejecución Formal", color: "var(--cat1)" },
            3: { name: "Contenido y Comprensión", color: "var(--cat3)" },
            4: { name: "Desempeño Estratégico", color: "var(--cat4)" }
        };
        const categoryHex = { 1: "#00B9C6", 3: "#E85D8A", 4: "#E8B23D" };

        const typologies = {
            logotipo_puro: { name: "Logotipo Puro", description: "Solo texto tipográfico sin elementos gráficos adicionales.", ventajas: ["Máxima simplicidad", "Fácil instalación", "Alta reproducibilidad"], desventajas: ["Depende enteramente de la calidad del nombre", "Menor capacidad de síntesis visual a distancia"] },
            logotipo_con_fondo: { name: "Logotipo con Fondo", description: "Texto contenido dentro de una figura o superficie de color.", ventajas: ["Mayor carácter marcario", "Reproducibilidad uniforme en distintos soportes", "Mayor impacto visual"], desventajas: ["Rendimiento limitado en espacios angostos (cenefas, barras)", "Puede condicionar el registro de un mensaje elegante o institucional"] },
            logotipo_con_simbolo: { name: "Logotipo con Símbolo", description: "Texto y símbolo funcionando como elementos independientes.", ventajas: ["Capacidad emblemática (el símbolo puede funcionar solo)", "Mayor llamado de atención", "Permite construir arquitectura de marca"], desventajas: ["Requiere instalar la convención símbolo–nombre en el público", "Más difícil de aplicar por tratarse de dos elementos"] },
            logotipo_con_accesorio: { name: "Logotipo con Accesorio", description: "Texto acompañado de un elemento decorativo menor, sin autonomía propia.", ventajas: ["Más carácter que el logotipo puro", "Flexible en distintos soportes"], desventajas: ["Sin capacidad emblemática independiente", "El accesorio puede volverse prescindible"] },
            logo_simbolo: { name: "Logo-símbolo", description: "Texto y símbolo fusionados en una sola unidad indivisible.", ventajas: ["Unidad total: siempre se ve igual, aprovecha la repetición", "Combina ventajas del fondo y del símbolo"], desventajas: ["Puede perder legibilidad en formatos muy horizontales o muy pequeños", "Mayor complejidad de ejecución"] },
            simbolo_solo: { name: "Símbolo Solo", description: "Solo ícono gráfico, sin caracteres tipográficos.", ventajas: ["Máxima síntesis visual", "Alta capacidad emblemática una vez instalado"], desventajas: ["Requiere un proceso previo de instalación en el público", "No comunica el nombre por sí mismo"] }
        };

        function renderTypologySelector() {
            const grid = document.getElementById('typologySelectGrid');
            let html = '<div class="typology-select-card auto selected" data-type="">'
                + '<div class="tsc-name">Detectar automáticamente</div>'
                + '<div class="tsc-desc">El sistema analiza la geometría de la imagen y sugiere la tipología. Podrás corregirla después si hace falta.</div>'
                + '</div>';
            Object.keys(typologies).forEach(key => {
                const t = typologies[key];
                html += '<div class="typology-select-card" data-type="' + key + '">'
                    + '<div class="tsc-name">' + t.name + '</div>'
                    + '<div class="tsc-desc">' + t.description + '</div>'
                    + '</div>';
            });
            grid.innerHTML = html;
            grid.querySelectorAll('.typology-select-card').forEach(card => {
                card.addEventListener('click', () => {
                    grid.querySelectorAll('.typology-select-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedTypologyOverride = card.dataset.type || null;
                });
            });
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            const label = theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
            const themeBtn = document.getElementById('themeToggleBtn');
            themeBtn.setAttribute('aria-label', label);
            themeBtn.setAttribute('title', label);
            localStorage.setItem('brandtest_theme', theme);
        }
        function toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            applyTheme(current === 'light' ? 'dark' : 'light');
        }

        // Menú de cuenta desplegable en el header: un solo trigger (avatar +
        // nombre + créditos) en vez de varios botones sueltos compitiendo
        // por espacio en la barra.
        function initAccountMenu() {
            const menu = document.getElementById('userSection');
            const trigger = document.getElementById('accountTrigger');
            const closeMenu = () => {
                menu.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            };
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !menu.classList.contains('open');
                menu.classList.toggle('open', willOpen);
                trigger.setAttribute('aria-expanded', String(willOpen));
            });
            document.addEventListener('click', (e) => {
                if (menu.classList.contains('open') && !menu.contains(e.target)) closeMenu();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeMenu();
            });
            document.getElementById('accountDropdown').addEventListener('click', (e) => {
                if (e.target.closest('button')) closeMenu();
            });
        }

        // Solo se muestra algo si el admin activó el interruptor — si no,
        // no se pide ni se expone ningún número.
        async function loadPublicStats() {
            try {
                const res = await fetch('/api/public-stats');
                const data = await res.json();
                if (!data.enabled) return;
                const line = document.getElementById('publicStatsLine');
                line.textContent = data.userCount + ' diseñadores ya usaron BrandTest · ' + data.totalAnalyses + ' análisis realizados';
                line.style.display = 'block';
            } catch (e) { /* silencioso — no es crítico para el login */ }
        }

        const startLegacyApp = async () => {
            loadDB();
            applyTheme(localStorage.getItem('brandtest_theme') || 'dark');
            renderTypologySelector();
            renderWhatsappCountrySelect();
            loadPublicStats();
            if (TESTING_MODE) document.getElementById('testingBadge').style.display = 'inline-block';
            await initAuth();
            document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
            document.getElementById('howItWorksBtn').addEventListener('click', openHowItWorks);
            document.getElementById('closeHowItWorksBtn').addEventListener('click', closeHowItWorks);
            document.getElementById('profileBtn').addEventListener('click', openProfile);
            document.getElementById('closeProfileBtn').addEventListener('click', closeProfile);
            document.getElementById('switchAccountLink').addEventListener('click', switchAccount);
            document.getElementById('guestLink').addEventListener('click', useAsGuest);
            document.getElementById('headerMenuToggle').addEventListener('click', toggleHeaderMenu);
            document.getElementById('headerMenuClose').addEventListener('click', closeHeaderMenu);
            document.getElementById('headerMenuBackdrop').addEventListener('click', closeHeaderMenu);
            document.getElementById('headerMenu').addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn || btn.id === 'accountTrigger') return;
                closeHeaderMenu();
            });
            initAccountMenu();

            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
            document.getElementById('selectFileBtn').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
            uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
            uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
            uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
            document.getElementById('cameraBtn').addEventListener('click', () => openCamera('main'));
            document.getElementById('captureBtn').addEventListener('click', capturePhoto);
            document.getElementById('closeCameraBtn').addEventListener('click', closeCamera);
            ['brightness','contrast','saturation','rotation'].forEach(id => document.getElementById(id).addEventListener('input', updateAdjustments));
            document.getElementById('whiteBalance').addEventListener('change', updateAdjustments);
            document.getElementById('analyzeBtn').addEventListener('click', analyzeBrand);
            document.getElementById('correctTypologyBtn').addEventListener('click', openTypologyModal);
            document.getElementById('acceptTypologyBtn').addEventListener('click', acceptTypologyCorrection);
            document.getElementById('exportCompleteBtn').addEventListener('click', () => exportReport('complete'));
            document.getElementById('exportSummaryBtn').addEventListener('click', () => exportReport('summary'));
            document.getElementById('logoutBtn').addEventListener('click', logout);
            document.getElementById('adminBtn').addEventListener('click', openAdmin);
            document.getElementById('cropBtn').addEventListener('click', openCropModal);
            document.getElementById('cropCancelBtn').addEventListener('click', closeCropModal);
            document.getElementById('cropConfirmBtn').addEventListener('click', confirmCrop);
            document.getElementById('cropRotateBtn').addEventListener('click', () => { if (cropperInstance) cropperInstance.rotate(90); });
            document.getElementById('cropResetBtn').addEventListener('click', () => { if (cropperInstance) cropperInstance.reset(); });
            document.getElementById('newAnalysisFromUploadBtn').addEventListener('click', clearImage);
            document.getElementById('newAnalysisBtn').addEventListener('click', resetApp);
            document.getElementById('saveHistoryBtn').addEventListener('click', saveDiagnosisToHistory);
            document.getElementById('recalcPaletteBtn').addEventListener('click', recalculatePalette);
            document.getElementById('calibSelectBtn').addEventListener('click', () => document.getElementById('calibImageInput').click());
            document.getElementById('calibCameraBtn').addEventListener('click', () => openCamera('calibration'));
            document.getElementById('calibImageInput').addEventListener('change', (e) => { if (e.target.files[0]) handleCalibFile(e.target.files[0]); });
            document.getElementById('calibSaveBtn').addEventListener('click', saveCalibrationSample);
            document.querySelectorAll('.admin-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
            });
            document.getElementById('recognitionStartBtn').addEventListener('click', startRecognitionTest);
            document.getElementById('publicStatsToggle').addEventListener('change', (e) => togglePublicStats(e.target.checked));
            document.getElementById('colorblindToggleBtn').addEventListener('click', toggleColorblindSimulation);
            ['calibColorCount','calibCalidad','calibRepro','calibLegib','calibIntel','calibVoca','calibPregnancia','calibOverall','calibConfidence'].forEach(id => {
                document.getElementById(id).addEventListener('input', (e) => {
                    document.getElementById(id + 'Val').textContent = e.target.value;
                });
            });
            document.getElementById('closeDiagnosticBtn').addEventListener('click', resetApp);
            document.getElementById('feedbackUpBtn').addEventListener('click', () => submitDiagnosticFeedback(true));
            document.getElementById('feedbackDownBtn').addEventListener('click', () => submitDiagnosticFeedback(false));
            initPricingReveal();
        };
        void startLegacyApp();

        // Revela las tarjetas de planes con un pequeño stagger cuando entran
        // en pantalla, en vez de mostrarlas todas de golpe.
        function initPricingReveal() {
            const cards = document.querySelectorAll('.pricing-card');
            if (!cards.length) return;
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduced) { cards.forEach(c => c.classList.add('in-view')); return; }
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const i = Array.from(cards).indexOf(entry.target);
                    setTimeout(() => entry.target.classList.add('in-view'), Math.max(0, i) * 90);
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.2 });
            cards.forEach(c => observer.observe(c));
        }

        function handleFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                selectedImage = e.target.result;
                adjustedImage = null;
                imageSource = 'upload';
                document.getElementById('previewImage').src = selectedImage;
                document.getElementById('previewSection').style.display = 'block';
                document.getElementById('editControls').style.display = 'none';
                notify('Imagen cargada');
            };
            reader.readAsDataURL(file);
        }

        // A qué destino va la foto capturada: 'main' (flujo normal de
        // análisis) o 'calibration' (banco de calibración del admin) — el
        // mismo modal de cámara sirve para los dos, sin duplicar código.
        let cameraCaptureTarget = 'main';

        function openCamera(target) {
            cameraCaptureTarget = target || 'main';
            document.getElementById('cameraModal').classList.add('active');
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
                    .then(stream => { cameraStream = stream; document.getElementById('cameraVideo').srcObject = stream; })
                    .catch(() => { notify('Error al acceder a la cámara'); closeCamera(); });
            } else {
                notify('Tu navegador no permite acceso a la cámara');
                closeCamera();
            }
        }
        function capturePhoto() {
            const video = document.getElementById('cameraVideo');
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');

            if (cameraCaptureTarget === 'calibration') {
                calibImageData = dataUrl;
                document.getElementById('calibPreview').src = calibImageData;
                document.getElementById('calibPreviewWrap').style.display = 'block';
                closeCamera();
                notify('Fotografía capturada para el banco de calibración');
                return;
            }

            selectedImage = dataUrl;
            adjustedImage = null;
            imageSource = 'camera';
            document.getElementById('previewImage').src = selectedImage;
            document.getElementById('previewSection').style.display = 'block';
            document.getElementById('editControls').style.display = 'block';
            closeCamera();
            notify('Fotografía capturada');
        }
        function closeCamera() {
            if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
            document.getElementById('cameraModal').classList.remove('active');
        }

        /* ---- Recorte (Cropper.js) ---- */
        function openCropModal() {
            if (!selectedImage) { notify('Primero sube o captura una imagen'); return; }
            const modal = document.getElementById('cropModal');
            const img = document.getElementById('cropperImageEl');
            img.src = selectedImage;
            modal.classList.add('active');
            if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
            cropperInstance = new Cropper(img, { viewMode: 1, dragMode: 'move', autoCropArea: 0.9, guides: true, center: true, background: false });
        }
        function closeCropModal() {
            document.getElementById('cropModal').classList.remove('active');
            if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
        }
        function confirmCrop() {
            if (!cropperInstance) return;
            const canvas = cropperInstance.getCroppedCanvas({ imageSmoothingQuality: 'high' });
            selectedImage = canvas.toDataURL('image/png');
            adjustedImage = null;
            document.getElementById('previewImage').src = selectedImage;
            closeCropModal();
            notify('Imagen recortada');
            // Si los controles de ajuste están visibles (foto de cámara), vuelve
            // a aplicar los valores actuales de los sliders sobre el recorte nuevo.
            if (document.getElementById('editControls').style.display !== 'none') updateAdjustments();
        }

        /* ---- Quitar imagen / reiniciar análisis ---- */
        function clearImage() {
            selectedImage = null;
            adjustedImage = null;
            imageSource = null;
            document.getElementById('previewSection').style.display = 'none';
            document.getElementById('editControls').style.display = 'none';
            document.getElementById('previewImage').src = '';
            document.getElementById('fileInput').value = '';
            ['brightness','contrast','saturation','rotation'].forEach(id => { document.getElementById(id).value = 0; });
            document.getElementById('whiteBalance').value = 'none';
            updateAdjustments();
        }
        function resetApp(silent) {
            clearImage();
            document.getElementById('brandName').value = '';
            document.getElementById('sector').value = '';
            document.getElementById('competitors').value = '';
            document.getElementById('brandAttributes').value = '';
            document.getElementById('planSelect').value = 'libre';
            correctedTypology = null;
            selectedTypologyOverride = null;
            renderTypologySelector();
            currentResults = null;
            excludedColorIndices = new Set();
            document.getElementById('colorblindSimulation').style.display = 'none';
            document.getElementById('colorblindToggleBtn').textContent = 'Simular daltonismo';
            document.getElementById('resultsSection').classList.remove('active');
            document.getElementById('uploadCard').scrollIntoView({ behavior: 'smooth' });
            if (!silent) notify('Listo para un nuevo análisis');
        }

        // Correcciones aproximadas de balance de blancos (no son una
        // transformación colorimétrica exacta de temperatura de color, pero
        // corrigen la dirección correcta del tinte típico de cada fuente de luz).
        const whiteBalancePresets = {
            daylight: [1.00, 1.00, 1.00],
            tungsten: [0.82, 0.94, 1.28],   // enfría: baja rojo, sube azul
            fluorescent: [1.05, 0.98, 1.08], // contrarresta el tinte verdoso
            shade: [1.22, 1.02, 0.85]        // calienta: sube rojo, baja azul
        };
        function clampWbFactor(f) { return Math.max(0.6, Math.min(1.6, f)); }

        function applyWhiteBalance(ctx, w, h, mode) {
            if (mode === 'none') return;
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            let factors;
            if (mode === 'auto') {
                let sumR = 0, sumG = 0, sumB = 0, n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i+3] < 10) continue;
                    sumR += data[i]; sumG += data[i+1]; sumB += data[i+2]; n++;
                }
                if (n === 0) return;
                const avgR = sumR/n, avgG = sumG/n, avgB = sumB/n;
                const avgGray = (avgR+avgG+avgB)/3;
                factors = [clampWbFactor(avgGray/avgR), clampWbFactor(avgGray/avgG), clampWbFactor(avgGray/avgB)];
            } else {
                factors = whiteBalancePresets[mode] || [1, 1, 1];
            }
            for (let i = 0; i < data.length; i += 4) {
                data[i]   = Math.min(255, data[i]   * factors[0]);
                data[i+1] = Math.min(255, data[i+1] * factors[1]);
                data[i+2] = Math.min(255, data[i+2] * factors[2]);
            }
            ctx.putImageData(imgData, 0, 0);
        }

        // Genera la imagen realmente corregida (no solo un filtro CSS de
        // vista previa) — esta es la que se analiza y la que se muestra,
        // para que nunca haya diferencia entre lo que el usuario ve y ajusta
        // y lo que el motor mide.
        function renderAdjustedImage() {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const b = Number(document.getElementById('brightness').value);
                    const c = Number(document.getElementById('contrast').value);
                    const s = Number(document.getElementById('saturation').value);
                    const rot = Number(document.getElementById('rotation').value);
                    const wb = document.getElementById('whiteBalance').value;

                    const rad = rot * Math.PI / 180;
                    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
                    const w = img.naturalWidth, h = img.naturalHeight;
                    const newW = Math.round(w*cos + h*sin) || w;
                    const newH = Math.round(w*sin + h*cos) || h;

                    const canvas = document.createElement('canvas');
                    canvas.width = newW; canvas.height = newH;
                    const ctx = canvas.getContext('2d');

                    let filter = '';
                    if (b != 0) filter += ' brightness(' + (1 + b/200) + ')';
                    if (c != 0) filter += ' contrast(' + (1 + c/200) + ')';
                    if (s != 0) filter += ' saturate(' + (1 + s/200) + ')';
                    ctx.filter = filter.trim() || 'none';

                    ctx.translate(newW/2, newH/2);
                    ctx.rotate(rad);
                    ctx.drawImage(img, -w/2, -h/2);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);

                    if (wb && wb !== 'none') applyWhiteBalance(ctx, newW, newH, wb);

                    adjustedImage = canvas.toDataURL('image/png');
                    resolve(adjustedImage);
                };
                img.src = selectedImage;
            });
        }

        async function updateAdjustments() {
            const b = document.getElementById('brightness').value;
            const c = document.getElementById('contrast').value;
            const s = document.getElementById('saturation').value;
            const r = document.getElementById('rotation').value;
            document.getElementById('brightnessVal').textContent = b;
            document.getElementById('contrastVal').textContent = c;
            document.getElementById('saturationVal').textContent = s;
            document.getElementById('rotationVal').textContent = r + '°';
            if (!selectedImage) return;
            const result = await renderAdjustedImage();
            const img = document.getElementById('previewImage');
            img.src = result;
            img.style.filter = '';
            img.style.transform = '';
        }

        /* =========================================================
           MOTOR DE ANÁLISIS — reglas y visión sobre la imagen real
           Todo lo de aquí abajo trabaja sobre píxeles reales de la
           imagen cargada (downsample a 100x100). No hay Math.random()
           en ninguna parte: cada puntaje sale de una métrica calculada
           (contraste WCAG, componentes conectados, simetría, densidad
           de bordes). Es un motor heurístico, no un modelo de IA — por
           eso siempre queda visible el botón "Corregir tipología".
           ========================================================= */

        function relLuminance(r, g, b) {
            const chan = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
            return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
        }
        function contrastRatioOf(c1, c2) {
            const L1 = relLuminance(c1.r, c1.g, c1.b), L2 = relLuminance(c2.r, c2.g, c2.b);
            const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
            return (lighter + 0.05) / (darker + 0.05);
        }
        function colorDistance(c1, c2) { return Math.sqrt((c1.r-c2.r)**2 + (c1.g-c2.g)**2 + (c1.b-c2.b)**2); }

        // --- Percepción de color (Lab) — para fusionar tonos que un ojo
        // humano vería como "el mismo color de marca" aunque el ruido de
        // una foto los haya dispersado en RGB. La distancia en RGB crudo
        // no corresponde a cómo se percibe el color (el mismo salto numérico
        // se ve enorme en verdes y casi invisible en azules); Lab sí.
        function rgbToLab(r, g, b) {
            let [rl, gl, bl] = [r, g, b].map(c => {
                c = c / 255;
                return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
            });
            let x = (rl*0.4124564 + gl*0.3575761 + bl*0.1804375) / 0.95047;
            let y = (rl*0.2126729 + gl*0.7151522 + bl*0.0721750) / 1.0;
            let z = (rl*0.0193339 + gl*0.1191920 + bl*0.9503041) / 1.08883;
            const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
            const fx = f(x), fy = f(y), fz = f(z);
            return { L: 116*fy - 16, a: 500*(fx-fy), b: 200*(fy-fz) };
        }
        function deltaE(lab1, lab2) { return Math.sqrt((lab1.L-lab2.L)**2 + (lab1.a-lab2.a)**2 + (lab1.b-lab2.b)**2); }

        // Recibe cubetas de la cuantización cruda (paso rápido) y las fusiona
        // por cercanía perceptual real, no por cercanía numérica en RGB.
        // Empieza por las cubetas más grandes para que los colores dominantes
        // "atraigan" al ruido cercano en vez de fragmentarse entre sí.
        function mergePerceptualColors(buckets, threshold) {
            const sorted = buckets.slice().sort((a, b) => b.count - a.count);
            const clusters = [];
            sorted.forEach(bucket => {
                const lab = rgbToLab(bucket.r, bucket.g, bucket.b);
                let target = null, best = Infinity;
                for (const c of clusters) {
                    const d = deltaE(lab, c.lab);
                    if (d < threshold && d < best) { target = c; best = d; }
                }
                if (target) {
                    const n = target.count + bucket.count;
                    target.r = (target.r*target.count + bucket.r*bucket.count) / n;
                    target.g = (target.g*target.count + bucket.g*bucket.count) / n;
                    target.b = (target.b*target.count + bucket.b*bucket.count) / n;
                    target.count = n;
                    target.lab = rgbToLab(target.r, target.g, target.b);
                } else {
                    clusters.push({ r: bucket.r, g: bucket.g, b: bucket.b, count: bucket.count, lab });
                }
            });
            return clusters;
        }

        function median(arr) { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; }

        function floodFillComponents(binary, w, h) {
            const visited = new Uint8Array(w * h);
            const components = [];
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    if (binary[idx] === 1 && !visited[idx]) {
                        const stack = [idx]; visited[idx] = 1;
                        let minX = x, maxX = x, minY = y, maxY = y, area = 0;
                        while (stack.length) {
                            const cur = stack.pop();
                            const cy = Math.floor(cur / w), cx = cur % w;
                            area++;
                            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                            const cand = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
                            for (const [nx, ny] of cand) {
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    const nidx = ny * w + nx;
                                    if (binary[nidx] === 1 && !visited[nidx]) { visited[nidx] = 1; stack.push(nidx); }
                                }
                            }
                        }
                        components.push({ minX, maxX, minY, maxY, area, w: maxX-minX+1, h: maxY-minY+1, cx: (minX+maxX)/2, cy: (minY+maxY)/2 });
                    }
                }
            }
            return components;
        }

        function computeSymmetry(binary, w, h) {
            let match = 0, total = 0;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < Math.floor(w/2); x++) {
                    total++;
                    if (binary[y*w+x] === binary[y*w+(w-1-x)]) match++;
                }
            }
            return total > 0 ? Math.round((match/total)*100) : 0;
        }

        function computeEdgeDensity(gray, w, h) {
            let sum = 0, count = 0;
            for (let y = 1; y < h-1; y++) {
                for (let x = 1; x < w-1; x++) {
                    const idx = y*w+x;
                    const gx = gray[idx+1] - gray[idx-1];
                    const gy = gray[idx+w] - gray[idx-w];
                    sum += Math.sqrt(gx*gx + gy*gy);
                    count++;
                }
            }
            return count > 0 ? sum / count : 0;
        }

        function groupComponents(components) {
            const real = components.filter(c => c.area >= 3);
            if (real.length === 0) return { textGroup: [], extras: [] };
            const heights = real.map(c => c.h);
            const centers = real.map(c => c.cy);
            const medH = median(heights), medC = median(centers);
            const textGroup = [], extras = [];
            real.forEach((c, i) => {
                const heightOk = medH > 0 && Math.abs(c.h - medH) / medH < 0.45;
                const centerOk = Math.abs(c.cy - medC) < 12;
                if (heightOk && centerOk) textGroup.push(c); else extras.push(c);
            });
            return { textGroup, extras };
        }

        async function analyzeImage() {
            const canvas = document.createElement('canvas');
            const img = new Image();
            return new Promise((resolve) => {
                img.onload = () => {
                    const W = 100, H = 100;
                    canvas.width = W; canvas.height = H;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, W, H);
                    const data = ctx.getImageData(0, 0, W, H).data;

                    // --- paso 1: cuantización rápida en cubetas RGB (barato,
                    // capta ruido de foto disperso en muchas cubetas vecinas) ---
                    const colorMap = new Map();
                    const colors = [];
                    const gray = new Float32Array(W*H);
                    let darkCount = 0, totalCount = 0;
                    for (let p = 0, i = 0; i < data.length; i += 4, p++) {
                        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                        const rgb = a < 128 ? { r:255,g:255,b:255 } : { r, g, b };
                        colors.push(rgb);
                        gray[p] = relLuminance(rgb.r, rgb.g, rgb.b) * 255;
                        if (a >= 128) {
                            totalCount++;
                            if (gray[p] < 100) darkCount++;
                            const qr = Math.round(r/16)*16, qg = Math.round(g/16)*16, qb = Math.round(b/16)*16;
                            const key = qr+','+qg+','+qb;
                            const entry = colorMap.get(key);
                            if (entry) { entry.count++; entry.rSum += r; entry.gSum += g; entry.bSum += b; }
                            else colorMap.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
                        }
                    }
                    const darkRatio = totalCount > 0 ? darkCount/totalCount : 0;

                    // --- paso 2: fusión perceptual (Lab) — junta cubetas que un
                    // ojo humano vería como el mismo color de marca, usando el
                    // centroide real de píxeles, no el valor de cubeta redondeado.
                    // El umbral depende de dónde vino la imagen: una foto de
                    // cámara tiene ruido fotográfico real que conviene absorber
                    // (umbral más permisivo); un archivo subido normalmente ya
                    // es limpio (un logo exportado), así que ahí se prioriza
                    // fidelidad al conteo real — un umbral bajo evita fusionar
                    // colores genuinamente distintos que el diseñador eligió
                    // a propósito, aunque estén perceptualmente cerca. ---
                    const mergeThreshold = imageSource === 'upload' ? 3 : 7;
                    const buckets = Array.from(colorMap.values()).map(e => ({
                        r: e.rSum/e.count, g: e.gSum/e.count, b: e.bSum/e.count, count: e.count
                    }));
                    const merged = mergePerceptualColors(buckets, mergeThreshold)
                        .sort((a, b) => b.count - a.count);
                    const significant = merged.filter(c => (c.count/totalCount) > 0.02).slice(0, 9);
                    const palette = significant.map(c => {
                        const rgb = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
                        const hex = '#' + [rgb.r, rgb.g, rgb.b].map(v => v.toString(16).padStart(2,'0')).join('');
                        return { hex, percentage: Math.round((c.count/totalCount)*100), rgb };
                    });
                    const bg = palette[0] ? palette[0].rgb : { r:255,g:255,b:255 };
                    const bgIsNearWhite = bg.r > 232 && bg.g > 232 && bg.b > 232;
                    const ink = palette.find(c => colorDistance(c.rgb, bg) > 60) || palette[1] || { rgb: { r:0,g:0,b:0 } };

                    // --- binarización: "tinta" = distinto del color de fondo dominante ---

                    const binary = new Uint8Array(W*H);
                    for (let p = 0; p < W*H; p++) binary[p] = colorDistance(colors[p], bg) > 45 ? 1 : 0;

                    const symmetryScore = computeSymmetry(binary, W, H);
                    const edgeRaw = computeEdgeDensity(gray, W, H);
                    const edgeComplexity = Math.max(0, Math.min(100, Math.round(edgeRaw / 2.2)));
                    const contrast = contrastRatioOf(bg, ink.rgb);

                    // --- componentes conectados y detección de "fondo" ---
                    const components = floodFillComponents(binary, W, H).filter(c => c.area >= 3);
                    let borderInk = 0, borderTotal = 0;
                    for (let x = 0; x < W; x++) { borderTotal += 2; if (binary[x]===1) borderInk++; if (binary[(H-1)*W+x]===1) borderInk++; }
                    for (let y = 0; y < H; y++) { borderTotal += 2; if (binary[y*W]===1) borderInk++; if (binary[y*W+(W-1)]===1) borderInk++; }
                    const hasFondo = !bgIsNearWhite && (borderInk/borderTotal) < 0.15 && totalCount > 0 && (1 - darkRatio) < 0.55;

                    const { textGroup, extras } = groupComponents(components);
                    const avgLetterArea = textGroup.length ? textGroup.reduce((a,c)=>a+c.area,0)/textGroup.length : 0;
                    const totalInkArea = components.reduce((a,c)=>a+c.area,0) || 1;
                    const largestComp = components.reduce((max,c)=> c.area > (max ? max.area : 0) ? c : max, null);
                    const largestAreaRatio = largestComp ? largestComp.area / totalInkArea : 0;

                    resolve({
                        W, H, palette, colorCount: palette.length,
                        bg, ink: ink.rgb, contrast, darkRatio,
                        symmetryScore, edgeComplexity,
                        components, componentCount: components.length,
                        // Conteo efectivo: el bloque de texto cuenta como
                        // una sola unidad (sin importar su largo), cada
                        // elemento no-texto (símbolo, accesorio) cuenta
                        // aparte. Se calcula una sola vez acá para que
                        // Inteligibilidad, Pregnancia y la métrica visible
                        // usen siempre el mismo número.
                        effectiveComponentCount: (textGroup.length > 0 ? 1 : 0) + extras.length,
                        textGroup, extras, avgLetterArea, hasFondo,
                        largestAreaRatio, inkRatio: totalInkArea / (W*H)
                    });
                };
                img.src = adjustedImage || selectedImage;
            });
        }

        function classifyColors(count) {
            if (count <= 1) return "Monocromía — Máxima versatilidad";
            if (count === 2) return "Bicromía — Muy buena reproducibilidad";
            if (count === 3) return "Tricromía — Buena reproducibilidad";
            if (count <= 4) return "Cuatricromía — Reproducibilidad aceptable";
            if (count <= 6) return "Policromía limitada — Reproducibilidad moderada";
            return "Policromía alta — Reproducibilidad comprometida";
        }

        // Describe la relación de tamaño entre el elemento adicional y las
        // letras de forma proporcional al número real — antes siempre decía
        // "área comparable" aunque el símbolo fuera 47 veces más grande que
        // una letra, lo cual no tiene sentido describir como "comparable".
        function describeAreaRatio(ratio) {
            if (ratio < 1.5) return "un área similar a la de las letras (" + Math.round(ratio*100) + "% del promedio)";
            if (ratio < 4) return "un área notablemente mayor que las letras (" + Math.round(ratio*100) + "% del promedio)";
            return "un área mucho mayor que las letras (" + ratio.toFixed(1) + " veces el promedio)";
        }

        function detectTypologyReal(d) {
            const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
            if (d.hasFondo) {
                return { type: 'logotipo_con_fondo', confidence: clamp(70 + Math.round((1-d.inkRatio)*20),65,93),
                    justification: "Se detectó una superficie de color dominante que cubre el " + Math.round((1-d.inkRatio)*100) + "% del encuadre, con el contenido principal contenido dentro de ella (bordes del encuadre mayormente sin interrupciones)." };
            }
            const letters = d.textGroup.length;
            const extra = d.extras.length ? d.extras.reduce((max,c)=> c.area>(max?max.area:0)?c:max, null) : null;
            if (extra) {
                const areaRatio = d.avgLetterArea > 0 ? extra.area / d.avgLetterArea : 99;
                const textBox = d.textGroup.length ? { minX: Math.min(...d.textGroup.map(c=>c.minX)), maxX: Math.max(...d.textGroup.map(c=>c.maxX)), minY: Math.min(...d.textGroup.map(c=>c.minY)), maxY: Math.max(...d.textGroup.map(c=>c.maxY)) } : null;
                const touches = textBox && !(extra.maxX < textBox.minX-3 || extra.minX > textBox.maxX+3 || extra.maxY < textBox.minY-3 || extra.minY > textBox.maxY+3);
                if (letters === 0) {
                    return { type: 'simbolo_solo', confidence: clamp(75 + (d.componentCount<=3?10:0),65,94),
                        justification: "No se detectó un patrón de elementos alineados y de altura similar (propio del texto); se identificó un elemento gráfico único de " + Math.round(extra.area/(d.W*d.H)*100) + "% de superficie." };
                }
                if (areaRatio < 0.6) {
                    return { type: 'logotipo_con_accesorio', confidence: clamp(68 + Math.round((0.6-areaRatio)*40),60,90),
                        justification: "Junto a " + letters + " elementos alineados de tipo texto, se detectó un elemento adicional de tamaño menor (" + Math.round(areaRatio*100) + "% del área promedio de las letras), compatible con un accesorio decorativo." };
                }
                if (touches) {
                    return { type: 'logo_simbolo', confidence: clamp(70 + Math.round(areaRatio*8),65,92),
                        justification: "El elemento adicional detectado tiene " + describeAreaRatio(areaRatio) + " y su posición se superpone o toca directamente el bloque de texto, sugiriendo una unidad fusionada." };
                }
                return { type: 'logotipo_con_simbolo', confidence: clamp(70 + Math.round(areaRatio*6),65,91),
                    justification: "El elemento adicional detectado tiene " + describeAreaRatio(areaRatio) + " y aparece separado del bloque de texto, funcionando como un elemento independiente." };
            }
            if (letters >= 2) {
                return { type: 'logotipo_puro', confidence: clamp(72 + (letters>=3?10:0),65,93),
                    justification: "Se detectaron " + letters + " elementos alineados en altura y posición vertical, sin elementos gráficos adicionales — patrón compatible con un bloque de texto." };
            }
            return { type: 'simbolo_solo', confidence: clamp(65 + (d.componentCount<=2?12:0),60,90),
                justification: "No se detectó un patrón de elementos alineados de tipo texto; predomina una forma única (" + d.componentCount + " elemento" + (d.componentCount===1?'':'s') + " detectado" + (d.componentCount===1?'':'s') + ")." };
        }

        function evaluateIndicatorsReal(d) {
            const clamp = (v,a,b) => Math.round(Math.max(a, Math.min(b, v)));
            const scores = {};
            const compAreas = d.components.map(c => c.area);
            const meanArea = compAreas.length ? compAreas.reduce((a,b)=>a+b,0)/compAreas.length : 0;
            const variance = compAreas.length ? compAreas.reduce((a,v)=>a+(v-meanArea)**2,0)/compAreas.length : 0;
            const cv = meanArea > 0 ? Math.sqrt(variance)/meanArea : 0;
            const cvPct = Math.round(cv*100);

            // Conteo EFECTIVO de unidades gráficas — no el bruto. Un logotipo
            // largo ("Ministerio", con el punto de la "i" como componente
            // suelto) no debe contarse letra por letra: todo el bloque de
            // texto es conceptualmente UNA sola unidad. Los elementos que no
            // son texto (símbolo, accesorio) sí se cuentan cada uno por
            // separado, porque ahí cada pieza extra realmente suma
            // complejidad de lectura. Esto solo aplica a Inteligibilidad y
            // Pregnancia — Calidad Gráfica sigue comparando letra por letra
            // a propósito, porque ahí lo que se mide es consistencia de
            // trazo entre caracteres, no cuántas piezas hay.
            const effectiveComponentCount = d.effectiveComponentCount;

            scores.calidad_grafica = { score: clamp(98 - cv*55, 50, 98),
                justification: "El trazo entre los " + d.componentCount + " elementos detectados muestra una variación de peso y proporción del " + cvPct + "%. " + (cvPct > 40
                    ? "Una variación así de alta señala grosores y remates poco uniformes entre sí — el conjunto todavía no se lee como un sistema coherente."
                    : "Los trazos mantienen un peso y una proporción razonablemente consistentes entre sí, lo que aporta unidad gráfica al conjunto.") };

            const colorPenalty = Math.max(0, d.colorCount-2) * 7;
            const bnPenalty = d.contrast < 3 ? 15 : 0;
            scores.reproducibilidad = { score: clamp(95 - colorPenalty - bnPenalty, 40, 98),
                justification: "La marca trabaja con " + d.colorCount + " color(es) en su paleta. " + (d.contrast >= 4.5
                    ? "El contraste entre fondo y tinta (" + d.contrast.toFixed(1) + ":1) es lo bastante alto como para sostener una reducción a escala de grises o a una sola tinta sin perder la figura — una condición clave para señalética y papelería de bajo costo."
                    : "El contraste entre fondo y tinta (" + d.contrast.toFixed(1) + ":1) es ajustado; conviene verificar que la marca no pierda presencia al reducirse a escala de grises o a una sola tinta.") };

            let legScore;
            if (d.contrast >= 7) legScore = 95; else if (d.contrast >= 4.5) legScore = 85; else if (d.contrast >= 3) legScore = 65; else legScore = 40;
            scores.legibilidad = { score: clamp(legScore, 30, 98),
                justification: "El contraste tonal entre fondo y tinta es de " + d.contrast.toFixed(2) + ":1, frente a un umbral de referencia de 4.5:1 para una lectura clara. " + (d.contrast >= 4.5
                    ? "Está por encima de ese umbral: la marca no depende del tamaño de reproducción para mantenerse legible."
                    : "Está por debajo de ese umbral, lo que puede volver la lectura difícil a tamaños reducidos o en aplicaciones de baja calidad de impresión.") };

            scores.inteligibilidad = { score: clamp(90 - Math.max(0, effectiveComponentCount-3)*6, 40, 95),
                justification: "Se identificaron " + effectiveComponentCount + " unidad(es) gráfica(s) conceptualmente independiente(s) (el bloque de texto cuenta como una sola unidad, sin importar su largo). " + (effectiveComponentCount > 5
                    ? "Es una fragmentación alta para un signo que busca leerse de un solo golpe visual: cuantas más piezas sueltas debe reconstruir el ojo, más lento y menos inmediato resulta el reconocimiento del conjunto."
                    : "La síntesis formal es razonable: pocas piezas independientes favorecen una lectura directa, sin necesidad de reconstruir el conjunto parte por parte.") };

            const satScore = clamp((Math.max(d.ink.r,d.ink.g,d.ink.b) - Math.min(d.ink.r,d.ink.g,d.ink.b)) / 2.55, 0, 100);
            const contrastPct = clamp((d.contrast/12)*100, 0, 100);
            const dominantPct = Math.round(d.largestAreaRatio*100);
            scores.vocatividad = { score: clamp(contrastPct*0.5 + satScore*0.3 + d.largestAreaRatio*100*0.2, 35, 97),
                justification: "El contraste tonal está en " + Math.round(contrastPct) + "% de su rango y el color dominante tiene una saturación de " + Math.round(satScore) + "%. El elemento de mayor peso visual concentra " + dominantPct + "% de la superficie de tinta total. " + (dominantPct >= 25
                    ? "Hay un punto focal razonablemente claro que concentra la atención."
                    : "Ningún elemento domina con claridad sobre el resto, lo que dispersa la atención en vez de concentrarla en un punto focal.") };

            const complexityPenalty = Math.max(0, effectiveComponentCount-4)*5;
            scores.pregnancia = { score: clamp(d.symmetryScore*0.4 + (100-d.edgeComplexity)*0.3 + (100-complexityPenalty)*0.3, 35, 96),
                justification: "La marca mantiene una simetría del " + d.symmetryScore + "% respecto a su eje vertical y una complejidad de forma de " + d.edgeComplexity + "/100, sobre " + effectiveComponentCount + " unidad(es) gráfica(s) conceptualmente independiente(s). " + (effectiveComponentCount <= 3 && d.symmetryScore >= 60
                    ? "Esta combinación de simetría y baja complejidad favorece el cierre gestáltico y la memorabilidad de la forma."
                    : "La cantidad de piezas independientes juega en contra de la memorabilidad: cuantas más partes sueltas tiene un signo, más difícil resulta evocarlo o dibujarlo de memoria.") };

            Object.keys(scores).forEach(k => { scores[k].score = Math.round(scores[k].score); });
            return scores;
        }

        const designRecommendations = {
            calidad_grafica: {
                low: 'Igualar el peso, los remates y las uniones entre los trazos más dispares del conjunto para que se lea como un sistema y no como piezas sueltas.',
                mid: 'Revisar puntualmente los trazos que más se alejan del peso promedio del conjunto.'
            },
            reproducibilidad: {
                low: 'Simplificar la paleta cromática y confirmar que la marca se mantenga reconocible en una sola tinta antes de producirla en papelería o señalética.',
                mid: 'Confirmar el comportamiento de la marca en blanco y negro antes de aplicaciones de bajo costo de impresión.'
            },
            legibilidad: {
                low: 'Aumentar el contraste entre fondo y tinta, o revisar el grosor de los trazos a los tamaños mínimos de aplicación.',
                mid: 'Verificar la legibilidad a los tamaños mínimos previstos (favicon, redes sociales, merchandising).'
            },
            inteligibilidad: {
                low: 'Evaluar una síntesis formal del signo: reducir el número de elementos independientes o considerar una versión reducida (isotipo o monograma) para usos donde el reconocimiento inmediato es crítico.',
                mid: 'Revisar si todos los elementos actuales aportan a la lectura del conjunto o si alguno puede integrarse o eliminarse.'
            },
            vocatividad: {
                low: 'Definir con más claridad un elemento dominante — por color, tamaño o posición — que concentre la atención antes que el resto de la composición.',
                mid: 'Reforzar el peso visual del elemento principal frente al resto de la composición.'
            },
            pregnancia: {
                low: 'Buscar mayor síntesis formal: un signo con menos partes independientes y un eje de simetría claro es más fácil de recordar y de reproducir a mano.',
                mid: 'Simplificar puntualmente los detalles que más se alejan de la forma dominante del conjunto.'
            }
        };

        // Indicadores "de piso" — Chaves y Belluccia los tratan como
        // técnicos o perceptuales, donde un puntaje bajo es objetivamente
        // deficiente (no hay lectura legítima en la que sea deseable que
        // estén bajos). Vocatividad queda fuera a propósito: el propio
        // libro (2.12) advierte que su nivel adecuado depende de la
        // identidad de cada marca — Mercedes-Benz es poco vocativa y es
        // una marca excelente; Texaco es muy vocativa y también lo es. Un
        // puntaje alto en Vocatividad no es evidencia de buena calidad, así
        // que no debe poder "tapar" fallas reales en los demás indicadores.
        const gateIndicatorKeys = ['calidad_grafica', 'reproducibilidad', 'legibilidad', 'inteligibilidad', 'pregnancia'];
        const GATE_MARGIN = 20;

        function getGateInfo(scores) {
            let worstKey = null, worstScore = 101;
            gateIndicatorKeys.forEach(k => {
                if (scores[k] && scores[k].score < worstScore) { worstScore = scores[k].score; worstKey = k; }
            });
            return { worstKey, worstScore, cap: worstScore + GATE_MARGIN };
        }

        function calculateOverall(scores) {
            let total = 0, weightSum = 0;
            Object.keys(scores).forEach(k => { total += scores[k].score * evaluableIndicators[k].weight; weightSum += evaluableIndicators[k].weight; });
            const weightedAvg = total / weightSum;
            const gate = getGateInfo(scores);
            return Math.round(Math.min(weightedAvg, gate.cap));
        }

        function diagnosticVerdict(score) {
            if (score >= 70) return { title: 'No necesita ajustes', color: 'var(--success)', stampLabel: 'Aprobado',
                description: 'La marca cumple de forma consistente los seis indicadores medidos: no se detectan problemas estructurales en la ejecución, el contraste o la composición.',
                recommendation: 'Mantener el sistema de marca actual. Conviene repetir esta medición cada vez que se ajuste la paleta, la tipografía o el símbolo, para verificar que el cambio no degrade el desempeño.' };
            if (score >= 50) return { title: 'Ajuste leve', color: 'var(--yellow)', stampLabel: 'Ajuste leve',
                description: 'La marca funciona en la mayoría de los indicadores, con uno o dos puntos débiles concretos que conviene revisar antes de una aplicación intensiva (papelería, señalética, medios digitales a gran escala).',
                recommendation: 'Revisar puntualmente los indicadores con menor puntaje (ver Recomendaciones para el Diseñador) sin necesidad de rediseñar la marca completa.' };
            if (score >= 35) return { title: 'Necesita ajustes', color: 'var(--magenta)', stampLabel: 'Revisar',
                description: 'Se detectan varias debilidades combinadas — contraste, complejidad de forma o reproducibilidad — que probablemente afecten el desempeño de la marca en aplicaciones reales.',
                recommendation: 'Planificar una intervención dirigida sobre los indicadores más bajos antes de invertir en producción a gran escala.' };
            return { title: 'Necesita rediseño', color: 'var(--danger)', stampLabel: 'Rediseño',
                description: 'La combinación de indicadores bajos sugiere problemas estructurales — no puntuales — en la construcción de la marca.',
                recommendation: 'Considerar un proceso de rediseño integral en vez de ajustes puntuales, partiendo del marco de indicadores de Chaves y Belluccia.' };
        }

        function categoryBreakdownHtml(scores) {
            let html = '<ul>';
            Object.keys(categories).forEach(catKey => {
                const catScores = [];
                Object.keys(evaluableIndicators).forEach(k => { if (evaluableIndicators[k].category === parseInt(catKey)) catScores.push(scores[k].score); });
                const avg = Math.round(catScores.reduce((a,b)=>a+b,0)/catScores.length);
                const tier = avg >= 70 ? 'sólido' : avg >= 50 ? 'aceptable, con margen de mejora' : 'débil';
                html += '<li><strong>' + categories[catKey].name + ' (' + avg + '%):</strong> desempeño ' + tier + '.</li>';
            });
            html += '</ul>';
            return html;
        }

        function generateRecommendations(scores) {
            const entries = Object.keys(scores).map(k => ({ key: k, name: evaluableIndicators[k].name, score: scores[k].score }));
            entries.sort((a, b) => a.score - b.score);
            const weak = entries.filter(e => e.score < 75).slice(0, 3);
            if (weak.length === 0) return '<p>Los seis indicadores se ubican por encima del umbral de atención (75%): no hay recomendaciones prioritarias pendientes.</p>';
            let html = '<ul>';
            weak.forEach(e => {
                const tier = e.score < 50 ? 'low' : 'mid';
                const rec = designRecommendations[e.key][tier];
                const label = e.score < 50 ? 'Atención prioritaria' : 'Ajuste puntual';
                html += '<li><strong>' + e.name + ' (' + e.score + '%) — ' + label + ':</strong> ' + rec + '</li>';
            });
            html += '</ul>';
            return html;
        }

        function generateDiagnostic(typology, scores, d, plan, aiSummary) {
            const t = typologies[typology.type];
            const overall = calculateOverall(scores);
            const verdict = diagnosticVerdict(overall);
            const gate = getGateInfo(scores);
            const gateApplied = overall < Math.round(Object.keys(scores).reduce((s,k) => s + scores[k].score*evaluableIndicators[k].weight, 0) / Object.keys(scores).reduce((s,k) => s + evaluableIndicators[k].weight, 0)) - 0.5;
            let html = '';

            html += '<h3>Veredicto General</h3>';
            html += '<p><strong style="color:' + verdict.color + ';">' + verdict.title + '</strong> — puntuación general ' + overall + '%.</p>';
            html += '<p>' + verdict.description + '</p>';
            html += '<p><strong>Recomendación general:</strong> ' + verdict.recommendation + '</p>';
            if (gateApplied) {
                html += '<div class="note-box" style="border-color:var(--magenta);">El puntaje general está limitado por <strong>' + evaluableIndicators[gate.worstKey].name + '</strong> (' + gate.worstScore + '%), el indicador más bajo — un problema grave en un solo indicador no se puede "diluir" promediándolo con los demás. Vocatividad queda fuera de este límite a propósito: su nivel adecuado depende de la identidad de cada marca (Chaves y Belluccia, 2.12), así que un puntaje alto ahí no compensa fallas reales en otro lado.</div>';
            }
            html += '<div class="note-box">Este informe es una herramienta de apoyo objetiva, construida a partir de mediciones reales sobre la imagen cargada (contraste, geometría, color, composición)' + (aiSummary ? ', complementadas con la lectura visual de un modelo de IA' : '') + '. No reemplaza el criterio de un profesional del diseño: la lectura final de una marca gráfica involucra contexto, estrategia de marca y decisiones que escapan a lo que una imagen por sí sola puede informar.<br><br>Los seis indicadores medidos forman parte del marco de 14 indicadores de calidad de marca desarrollado por Norberto Chaves y Raúl Belluccia (2003). Este informe mide 6 de los 14; los ocho restantes (suficiencia, vigencia, ajuste tipológico, corrección estilística, compatibilidad semántica, versatilidad, singularidad, declinabilidad) requieren contexto adicional que este instrumento no evalúa.</div>';

            if (aiSummary) {
                html += '<h3>Lectura Visual (IA)</h3>';
                html += '<p>' + aiSummary + '</p>';
            }

            html += '<h3>Análisis Estructural</h3>';
            html += '<p>La marca fue clasificada como <strong>' + t.name + '</strong>. ' + t.description + '</p>';
            html += '<p><strong>Base de la clasificación:</strong> ' + typology.justification + '</p>';

            html += '<h3>Métricas Calculadas</h3>';
            html += '<div class="metrics-strip">'
                + '<span class="metric-chip">Contraste: <strong>' + d.contrast.toFixed(2) + ':1</strong></span>'
                + '<span class="metric-chip">Simetría: <strong>' + d.symmetryScore + '%</strong></span>'
                + '<span class="metric-chip">Complejidad: <strong>' + d.edgeComplexity + '/100</strong></span>'
                + '<span class="metric-chip">Elementos: <strong>' + (d.effectiveComponentCount ?? d.componentCount) + '</strong></span>'
                + '<span class="metric-chip">Colores: <strong>' + d.colorCount + '</strong></span>'
                + '<span class="metric-chip">Cobertura de tinta: <strong>' + Math.round(d.inkRatio*100) + '%</strong></span>'
                + '</div>';

            html += '<h3>Desglose por Categoría</h3>';
            html += categoryBreakdownHtml(scores);

            html += '<h3>Recomendaciones para el Diseñador</h3>';
            html += generateRecommendations(scores);

            html += '<h3>Ventajas del Tipo</h3><ul>'; t.ventajas.forEach(v => html += '<li>' + v + '</li>'); html += '</ul>';
            html += '<h3>Desventajas del Tipo</h3><ul>'; t.desventajas.forEach(v => html += '<li>' + v + '</li>'); html += '</ul>';

            if (plan === 'libre' && !TESTING_MODE) {
                html += '<p style="color:var(--yellow);"><strong>Plan Libre:</strong> informe limitado. Actualiza a Estándar o Pro para el detalle completo de indicadores y criterios.</p>';
            } else {
                html += '<h3 class="print-detail-only">Resultados por Indicador</h3>';
                html += '<div class="print-detail-only">';
                Object.keys(scores).forEach(k => { html += '<p><strong>' + evaluableIndicators[k].name + ': ' + scores[k].score + '%</strong><br>' + scores[k].justification + '</p>'; });
                html += '</div>';
                html += '<h3 class="print-detail-only">Criterios de Evaluación de Referencia</h3>';
                html += '<div class="print-detail-only criteria-groups">';
                Object.keys(evaluableIndicators).forEach(k => {
                    html += '<div class="criteria-group"><p class="criteria-group-title">' + evaluableIndicators[k].name + '</p><ul>';
                    evaluableIndicators[k].criteria.forEach(c => html += '<li>' + c + '</li>');
                    html += '</ul></div>';
                });
                html += '</div>';
            }
            html += '<h3>Análisis Cromático</h3>';
            html += '<p>' + d.colorCount + ' colores detectados. ' + classifyColors(d.colorCount) + '.</p>';
            return html;
        }

        // Llama a la función de servidor que analiza la imagen con Claude
        // (visión), mandando también las métricas reales ya calculadas como
        // base objetiva. Si algo falla (sin llave configurada aún, red caída,
        // etc.) devuelve null — quien llama debe caer al motor de reglas.
        async function callClaudeAnalysis(d) {
            const imgSrc = adjustedImage || selectedImage;
            const match = imgSrc.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) return null;
            const mediaType = match[1], base64 = match[2];
            const metrics = { contrast: d.contrast, symmetryScore: d.symmetryScore, edgeComplexity: d.edgeComplexity, componentCount: d.componentCount, effectiveComponentCount: d.effectiveComponentCount, colorCount: d.colorCount, inkRatio: d.inkRatio };
            const context = {
                brandName: document.getElementById('brandName').value.trim(),
                sector: document.getElementById('sector').value.trim(),
                competitors: document.getElementById('competitors').value.trim(),
                attributes: document.getElementById('brandAttributes').value.trim()
            };
            // Los usuarios con cuenta mandan su sesión real (se verifica en
            // el servidor). Los invitados no tienen sesión — la IA sigue
            // disponible para ellos por decisión explícita, pero el
            // servidor aplica su propio límite por IP en ese caso.
            const headers = { 'Content-Type': 'application/json' };
            if (!isGuest) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) headers['Authorization'] = 'Bearer ' + session.access_token;
            }
            const res = await fetch('/api/analyze-brand', {
                method: 'POST', headers,
                body: JSON.stringify({ imageBase64: base64, mediaType, metrics, context })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error de análisis con IA');
            return data.analysis;
        }

        function buildScoresFromAI(ai) {
            const keys = ['calidad_grafica', 'reproducibilidad', 'legibilidad', 'inteligibilidad', 'vocatividad', 'pregnancia'];
            const scores = {};
            keys.forEach(k => { scores[k] = { score: ai[k], justification: ai[k + '_justification'] }; });
            return scores;
        }

        async function analyzeBrand() {
            if (!selectedImage) { notify('Selecciona una imagen primero'); return; }
            const plan = document.getElementById('planSelect').value;

            // El permiso y el descuento de créditos ya NO se deciden en el
            // navegador — credits/plan/total_analyses/last_free_analysis están
            // protegidas a nivel de columna en la base de datos, así que solo
            // la función de servidor (con la sesión real verificada) puede
            // tocarlas. El único caso que se resuelve localmente es el de
            // invitado, que no tiene cuenta ni fila que proteger.
            const unlimited = TESTING_MODE || currentUser.is_admin;
            let check = { allowed: true };
            if (isGuest) {
                check = checkGuestPermission(plan);
            } else if (!unlimited) {
                check = await consumeCreditServer(plan);
            }
            if (!check.allowed) { notify(check.message); return; }

            excludedColorIndices = new Set();
            document.getElementById('loadingIndicator').classList.add('active');
            document.getElementById('resultsSection').classList.remove('active');
            const d = await analyzeImage();

            const manualTypology = correctedTypology || (selectedTypologyOverride ? {
                type: selectedTypologyOverride,
                name: typologies[selectedTypologyOverride].name,
                confidence: 100,
                justification: "Tipología confirmada por el usuario antes del análisis — el diagnóstico se construye sobre esta elección."
            } : null);

            let typology = manualTypology;
            let scores = null;
            let aiSummary = null;
            try {
                const ai = await callClaudeAnalysis(d);
                if (ai) {
                    if (!manualTypology) {
                        typology = { type: ai.typology, name: typologies[ai.typology].name, confidence: ai.typology_confidence, justification: ai.typology_justification };
                    }
                    scores = buildScoresFromAI(ai);
                    aiSummary = ai.diagnostic_summary;
                }
            } catch (e) {
                console.warn('Análisis con IA no disponible, se usa el motor de reglas:', e.message);
            }
            if (!scores) scores = evaluateIndicatorsReal(d);
            if (!typology) typology = detectTypologyReal(d);

            if (isGuest && !unlimited) localStorage.setItem('brandtest_guest_last_use', new Date().toISOString());

            const results = {
                typology,
                colors: { count: d.colorCount, palette: d.palette, classification: classifyColors(d.colorCount) },
                indicators: scores,
                overallScore: calculateOverall(scores),
                aiSummary,
                diagnostic: generateDiagnostic(typology, scores, d, plan, aiSummary),
                plan, rawData: d,
                imageUsed: adjustedImage || selectedImage,
                brandNameUsed: document.getElementById('brandName').value.trim(),
                analyzedAt: new Date().toISOString()
            };
            setTimeout(() => {
                displayResults(results);
                document.getElementById('loadingIndicator').classList.remove('active');
                document.getElementById('resultsSection').classList.add('active');
                notify(aiSummary ? 'Análisis completado con Claude' : 'Análisis completado');
            }, 350);
        }

        // Único chequeo que sigue viviendo en el navegador — el invitado no
        // tiene cuenta ni fila en la base de datos que proteger, así que no
        // hay nada sensible que mover al servidor en este caso.
        function checkGuestPermission(plan) {
            if (plan !== 'libre') return { allowed: false, message: 'Como invitado solo puedes usar el plan Libre — crea una cuenta gratis para Estándar o Pro' };
            const last = localStorage.getItem('brandtest_guest_last_use');
            if (last) {
                const hoursSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
                if (hoursSince < 48) return { allowed: false, message: 'Espera ' + Math.ceil(48 - hoursSince) + ' horas para otro análisis sin registro, o crea una cuenta' };
            }
            return { allowed: true };
        }

        // Llama a la función de servidor que verifica la sesión real y
        // descuenta créditos de forma segura. Actualiza currentUser con lo
        // que el servidor confirme — nunca con lo que el navegador calculó.
        async function consumeCreditServer(plan) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return { allowed: false, message: 'Tu sesión expiró — vuelve a entrar' };
            try {
                const res = await fetch('/api/consume-credit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
                    body: JSON.stringify({ plan })
                });
                const data = await res.json();
                if (!res.ok) return { allowed: false, message: data.error || 'No se pudo verificar tu plan' };
                if (data.remainingCredits !== undefined) currentUser.credits = data.remainingCredits;
                if (data.plan) currentUser.plan = data.plan;
                if (data.totalAnalyses !== undefined) currentUser.total_analyses = data.totalAnalyses;
                updateUserUI();
                return { allowed: true };
            } catch (e) {
                return { allowed: false, message: 'Error de conexión al verificar tu plan: ' + e.message };
            }
        }

        function animateScoreCount(el, target) {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = target + '<span>%</span>'; return; }
            const duration = 700, startTime = performance.now();
            function tick(now) {
                const progress = Math.min(1, (now - startTime) / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.innerHTML = Math.round(target * eased) + '<span>%</span>';
                if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        }

        function displayResults(results) {
            document.getElementById('analyzedImage').src = results.imageUsed || '';
            document.getElementById('analyzedBrandName').textContent = results.brandNameUsed ? results.brandNameUsed : 'Marca sin nombre';
            document.getElementById('analyzedDate').textContent = new Date(results.analyzedAt || Date.now()).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('feedbackUpBtn').classList.remove('selected');
            document.getElementById('feedbackDownBtn').classList.remove('selected');
            document.getElementById('feedbackThanks').style.display = 'none';
            document.getElementById('feedbackQuestion').style.display = 'inline';
            document.getElementById('feedbackButtons').style.display = 'flex';
            animateScoreCount(document.getElementById('overallScore'), results.overallScore);
            const verdict = diagnosticVerdict(results.overallScore);
            const stamp = document.getElementById('verdictStamp');
            stamp.style.setProperty('--stamp-color', verdict.color);
            document.getElementById('verdictStampText').textContent = verdict.stampLabel;
            stamp.style.display = 'flex';
            renderRadarChart(results);
            renderCategoryBars(results);
            document.getElementById('typologyName').textContent = results.typology.name || typologies[results.typology.type].name;
            document.getElementById('typologyJustification').textContent = results.typology.justification;
            document.getElementById('typologyConfidence').textContent = results.typology.confidence + '%';
            document.getElementById('typologyConfidenceBar').style.width = results.typology.confidence + '%';
            const t = typologies[results.typology.type];
            document.getElementById('typologyDetails').innerHTML = '<div style="margin-bottom:0.4rem;"><strong style="color:var(--success);">Ventajas:</strong></div><ul style="margin-left:1rem; margin-bottom:0.5rem; font-size:0.75rem; color:var(--text-muted); max-width:65ch;">' + t.ventajas.map(v=>'<li>'+v+'</li>').join('') + '</ul><div style="margin-bottom:0.4rem;"><strong style="color:var(--danger);">Desventajas:</strong></div><ul style="margin-left:1rem; font-size:0.75rem; color:var(--text-muted); max-width:65ch;">' + t.desventajas.map(v=>'<li>'+v+'</li>').join('') + '</ul>';
            const paletteDiv = document.getElementById('colorPalette');
            paletteDiv.innerHTML = '';
            results.colors.palette.forEach((c, i) => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch' + (excludedColorIndices.has(i) ? ' excluded' : '');
                swatch.style.backgroundColor = c.hex;
                swatch.innerHTML = '<span class="color-tooltip">' + c.hex + ' (' + c.percentage + '%)' + (excludedColorIndices.has(i) ? ' — excluido' : '') + '</span>';
                swatch.addEventListener('click', () => {
                    if (excludedColorIndices.has(i)) excludedColorIndices.delete(i); else excludedColorIndices.add(i);
                    displayResults(currentResults);
                });
                paletteDiv.appendChild(swatch);
            });
            document.getElementById('colorClassification').textContent = results.colors.classification;
            document.getElementById('recalcPaletteBtn').style.display = results.colors.palette.length > 1 ? 'inline-block' : 'none';
            const grid = document.getElementById('resultsGrid');
            grid.innerHTML = '';
            Object.keys(categories).forEach(catKey => {
                const cat = categories[catKey];
                const section = document.createElement('div');
                section.className = 'category-section';
                const header = document.createElement('div');
                header.className = 'category-header';
                header.style.backgroundColor = categoryHex[catKey];
                header.style.color = '#0B1213';
                const catScores = [];
                Object.keys(evaluableIndicators).forEach(k => { if (evaluableIndicators[k].category === parseInt(catKey)) catScores.push(results.indicators[k].score); });
                const avg = Math.round(catScores.reduce((a,b)=>a+b,0)/catScores.length);
                header.innerHTML = '<span>' + cat.name + '</span><span>' + avg + '%</span>';
                const body = document.createElement('div');
                body.className = 'category-body';
                Object.keys(evaluableIndicators).forEach(k => {
                    const ind = evaluableIndicators[k];
                    if (ind.category === parseInt(catKey)) {
                        const res = results.indicators[k];
                        const item = document.createElement('div');
                        item.className = 'indicator-item';
                        const color = res.score >= 80 ? '#4FAE7A' : res.score >= 60 ? '#E8B23D' : '#D9614F';
                        item.innerHTML = '<div class="indicator-header"><div><div class="indicator-name">' + ind.name + '</div><div class="indicator-definition">' + ind.definition + '</div></div><div class="indicator-score" style="color:' + color + ';">' + res.score + '%</div></div><div class="score-bar"><div class="score-fill" style="width:' + res.score + '%; background:' + categoryHex[catKey] + ';"></div></div><div class="indicator-justification">' + res.justification + '</div>' + (results.plan !== 'libre' ? '<div class="indicator-detail print-detail-only">' + ind.criteria.map(c=>'• '+c).join('<br>') + '</div>' : '');
                        body.appendChild(item);
                    }
                });
                section.appendChild(header); section.appendChild(body); grid.appendChild(section);
            });
            document.getElementById('diagnosticText').innerHTML = results.diagnostic;
            document.getElementById('exportCard').style.display = (results.plan === 'libre' && !TESTING_MODE) ? 'none' : 'block';
            currentResults = results;
        }

        // Etiquetas cortas para los ejes del radar (evita que el texto se corte
        // contra el borde del gráfico). El nombre completo de cada indicador
        // sigue disponible en las tarjetas de detalle debajo del radar.
        const radarShortLabels = {
            calidad_grafica: 'Calidad',
            reproducibilidad: 'Reproducib.',
            legibilidad: 'Legibilidad',
            inteligibilidad: 'Inteligib.',
            vocatividad: 'Vocatividad',
            pregnancia: 'Pregnancia'
        };

        function renderRadarChart(results) {
            const container = document.getElementById('radarChart');
            const size = 520, center = size/2, radius = 170, labelOffset = 40;
            const keys = Object.keys(evaluableIndicators);
            const shortLabels = keys.map(k => radarShortLabels[k]);
            const values = keys.map(k => results.indicators[k].score);
            const cats = keys.map(k => evaluableIndicators[k].category);
            const count = shortLabels.length;
            let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Radar de los 6 indicadores de calidad">';
            for (let level = 1; level <= 5; level++) {
                const r = radius*level/5, pct = level*20;
                svg += '<circle class="radar-grid" cx="'+center+'" cy="'+center+'" r="'+r+'" fill="none" stroke-width="0.75"/>';
                svg += '<text class="radar-ring-label" x="'+(center+6)+'" y="'+(center-r+3)+'" font-size="9" font-family="IBM Plex Mono, monospace">'+pct+'%</text>';
            }
            for (let i = 0; i < count; i++) { const angle = (Math.PI*2*i)/count - Math.PI/2; const x = center+radius*Math.cos(angle), y = center+radius*Math.sin(angle); svg += '<line class="radar-grid" x1="'+center+'" y1="'+center+'" x2="'+x+'" y2="'+y+'" stroke-width="0.75"/>'; }
            const pts = [];
            for (let i = 0; i < count; i++) { const angle=(Math.PI*2*i)/count-Math.PI/2; const r=radius*values[i]/100; pts.push((center+r*Math.cos(angle))+','+(center+r*Math.sin(angle))); }
            svg += '<polygon class="radar-polygon" points="'+pts.join(' ')+'"/>';
            for (let i = 0; i < count; i++) { const angle=(Math.PI*2*i)/count-Math.PI/2; const r=radius*values[i]/100; svg += '<circle class="radar-point" cx="'+(center+r*Math.cos(angle))+'" cy="'+(center+r*Math.sin(angle))+'" r="5.5" stroke-width="2.5"/>'; }
            for (let i = 0; i < count; i++) {
                const angle=(Math.PI*2*i)/count-Math.PI/2; const x=center+(radius+labelOffset)*Math.cos(angle), y=center+(radius+labelOffset)*Math.sin(angle);
                const anchor = Math.abs(x-center)<24 ? 'middle' : x>center ? 'start' : 'end';
                const catColor = categoryHex[cats[i]];
                svg += '<text class="radar-axis-label" x="'+x+'" y="'+y+'" font-size="11.5" font-family="IBM Plex Sans, sans-serif" text-anchor="'+anchor+'" dominant-baseline="middle">'+shortLabels[i]+'</text>';
                svg += '<text class="radar-value" data-target="'+values[i]+'" x="'+x+'" y="'+(y+17)+'" fill="'+catColor+'" font-size="16" font-weight="700" font-family="IBM Plex Mono, monospace" text-anchor="'+anchor+'" dominant-baseline="middle">0%</text>';
            }
            svg += '</svg>';
            container.innerHTML = svg;

            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const valueEls = container.querySelectorAll('.radar-value');
            if (reduced) {
                valueEls.forEach(t => { t.textContent = t.getAttribute('data-target') + '%'; });
                return;
            }

            const polygon = container.querySelector('.radar-polygon');
            if (polygon) {
                const len = polygon.getTotalLength();
                polygon.style.strokeDasharray = len;
                polygon.style.strokeDashoffset = len;
                polygon.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)';
                requestAnimationFrame(() => requestAnimationFrame(() => { polygon.style.strokeDashoffset = 0; }));
            }
            container.querySelectorAll('.radar-point').forEach((p, i) => {
                p.style.opacity = '0';
                p.style.transform = 'scale(0)';
                p.style.transformOrigin = 'center';
                p.style.transformBox = 'fill-box';
                p.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
                setTimeout(() => { p.style.opacity = '1'; p.style.transform = 'scale(1)'; }, 500 + i*70);
            });
            valueEls.forEach(t => {
                const target = parseInt(t.getAttribute('data-target'), 10);
                const duration = 1000, start = performance.now();
                function tick(now) {
                    const progress = Math.min(1, (now - start) / duration);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    t.textContent = Math.round(target * eased) + '%';
                    if (progress < 1) requestAnimationFrame(tick);
                }
                requestAnimationFrame(tick);
            });
        }

        function renderCategoryBars(results) {
            const container = document.getElementById('categoryBars');
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let html = '';
            Object.keys(categories).forEach(catKey => {
                const catIndicatorKeys = Object.keys(evaluableIndicators).filter(k => evaluableIndicators[k].category === parseInt(catKey));
                const catScores = catIndicatorKeys.map(k => results.indicators[k].score);
                const avg = Math.round(catScores.reduce((a,b)=>a+b,0)/catScores.length);
                const color = categoryHex[catKey];
                const tier = avg >= 70 ? 'Sólido' : avg >= 50 ? 'Aceptable' : 'Débil';
                const detail = catIndicatorKeys.map(k => '<strong>' + evaluableIndicators[k].name + '</strong> ' + results.indicators[k].score + '%').join(' &nbsp;·&nbsp; ');
                html += '<div class="category-bar-row">'
                    + '<div class="category-bar-header"><span class="category-bar-name">' + categories[catKey].name + '</span><span class="category-bar-value" style="color:' + color + ';">' + avg + '% — ' + tier + '</span></div>'
                    + '<div class="category-bar-track"><div class="category-bar-fill" data-target="' + avg + '" style="background:' + color + ';"></div></div>'
                    + '<div class="category-bar-detail">' + detail + '</div>'
                    + '</div>';
            });
            container.innerHTML = html;
            const fills = container.querySelectorAll('.category-bar-fill');
            if (reduced) { fills.forEach(f => { f.style.width = f.getAttribute('data-target') + '%'; }); return; }
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fills.forEach(f => { f.style.width = f.getAttribute('data-target') + '%'; });
            }));
        }

        function openTypologyModal() {
            const modal = document.getElementById('typologyModal');
            modal.classList.add('active');
            const container = document.getElementById('typologyOptions');
            container.innerHTML = '';
            Object.keys(typologies).forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'typology-option';
                btn.textContent = typologies[key].name;
                btn.dataset.type = key;
                if (currentResults && currentResults.typology.type === key) btn.classList.add('selected');
                btn.addEventListener('click', () => { document.querySelectorAll('.typology-option').forEach(o=>o.classList.remove('selected')); btn.classList.add('selected'); });
                container.appendChild(btn);
            });
        }
        // Segunda pieza del mismo mecanismo de calibración: una opinión directa
        // sobre el diagnóstico completo (no solo la tipología), para ir viendo
        // con el uso real si el resultado en conjunto se siente acertado.
        function submitDiagnosticFeedback(positive) {
            if (!currentResults) return;
            db.diagnosticFeedback.push({
                positive,
                typology: currentResults.typology.type,
                overallScore: currentResults.overallScore,
                plan: currentResults.plan,
                date: new Date().toISOString()
            });
            saveDB();
            document.getElementById('feedbackUpBtn').classList.toggle('selected', positive);
            document.getElementById('feedbackDownBtn').classList.toggle('selected', !positive);
            document.getElementById('feedbackQuestion').style.display = 'none';
            document.getElementById('feedbackButtons').style.display = 'none';
            document.getElementById('feedbackThanks').style.display = 'inline';
        }

        function acceptTypologyCorrection() {
            const selected = document.querySelector('.typology-option.selected');
            if (selected) {
                const type = selected.dataset.type;
                const previous = currentResults ? currentResults.typology : null;
                correctedTypology = { type, name: typologies[type].name, confidence: 100, justification: "Tipología corregida manualmente por el usuario." };
                document.getElementById('typologyModal').classList.remove('active');
                if (currentResults) {
                    // Registro de calibración: cada corrección real es un dato de
                    // "el sistema predijo X, el usuario dijo Y". Con el tiempo esto
                    // es lo que permite ajustar los umbrales del árbol de reglas
                    // contra casos reales, en vez de una sola sesión de calibración.
                    if (previous && previous.type !== type) {
                        db.typologyFeedback.push({
                            predicted: previous.type, predictedConfidence: previous.confidence,
                            corrected: type, date: new Date().toISOString()
                        });
                        saveDB();
                    }
                    currentResults.typology = correctedTypology;
                    // El diagnóstico completo (ventajas/desventajas, análisis estructural)
                    // se regenera con la tipología corregida — si solo actualizáramos la
                    // tarjeta de tipología, el resto del informe seguiría describiendo
                    // el tipo anterior, lo cual es inconsistente.
                    currentResults.diagnostic = generateDiagnostic(correctedTypology, currentResults.indicators, currentResults.rawData, currentResults.plan, currentResults.aiSummary);
                    displayResults(currentResults);
                }
                notify('Tipología corregida — el informe se actualizó por completo');
            }
        }

        function exportReport(type) {
            if (!currentResults) { notify('No hay resultados'); return; }
            document.body.classList.toggle('print-summary', type === 'summary');
            window.print();
            setTimeout(() => document.body.classList.remove('print-summary'), 500);
        }

        function notify(message) {
            const n = document.getElementById('notification');
            n.textContent = message;
            n.classList.add('show');
            setTimeout(() => n.classList.remove('show'), 3000);
        }

        Object.assign(window, {
            acreditarCreditos,
            closeAdmin,
            loginWithGoogle,
            saveWhatsapp,
            solicitarCreditos
        });

        // Registro del service worker — habilita "instalar" BrandTest desde
        // el navegador (ícono en pantalla de inicio, pantalla completa).
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js').catch(() => {});
            });
        }
}

