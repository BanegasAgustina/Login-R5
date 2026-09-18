// Script automatizado de pruebas para verificar endpoints y seguridad de PetCare
import '../src/config/database.js';
const API_URL = process.env.TEST_API_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api`;
for (const name of ['TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD', 'TEST_VET_EMAIL', 'TEST_VET_PASSWORD', 'TEST_CLIENT_EMAIL', 'TEST_CLIENT_PASSWORD']) {
  if (!process.env[name]) throw new Error(`Falta ${name} para la suite histórica.`);
}

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE PETCARE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${API_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.ok === true, 'GET /api/health responde 200 OK');

    // 2. Login Admin
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginData.token, 'Login Administrador exitoso');
    assert(!adminLoginData.usuario.password_hash && !adminLoginData.usuario.password, 'No se expone hash de contraseña en login');
    const adminToken = adminLoginData.token;

    // 3. Admin endpoints
    const resumenRes = await fetch(`${API_URL}/admin/resumen`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resumenData = await resumenRes.json();
    assert(resumenRes.status === 200 && typeof resumenData.usuarios === 'number', 'GET /api/admin/resumen devuelve métricas reales');

    const usersRes = await fetch(`${API_URL}/admin/usuarios`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersData = await usersRes.json();
    assert(usersRes.status === 200 && Array.isArray(usersData) && usersData.length > 0, 'GET /api/admin/usuarios devuelve usuarios reales');

    const petsRes = await fetch(`${API_URL}/admin/mascotas`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const petsData = await petsRes.json();
    assert(petsRes.status === 200 && Array.isArray(petsData), 'GET /api/admin/mascotas devuelve mascotas');

    const adminTurnosRes = await fetch(`${API_URL}/admin/turnos`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminTurnosData = await adminTurnosRes.json();
    assert(adminTurnosRes.status === 200 && Array.isArray(adminTurnosData), 'GET /api/admin/turnos devuelve turnos');

    const turnoDetailRes = await fetch(`${API_URL}/admin/turnos/1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(turnoDetailRes.status === 200, 'GET /api/admin/turnos/:id devuelve detalle del turno');

    // 4. Login Veterinario
    const vetLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_VET_EMAIL, password: process.env.TEST_VET_PASSWORD }),
    });
    const vetLoginData = await vetLoginRes.json();
    assert(vetLoginRes.status === 200 && vetLoginData.token, 'Login Veterinario exitoso');
    const vetToken = vetLoginData.token;

    const hoyRes = await fetch(`${API_URL}/turnos/hoy`, {
      headers: { Authorization: `Bearer ${vetToken}` },
    });
    assert(hoyRes.status === 200, 'GET /api/turnos/hoy accesible para Veterinario');

    const pacientesRes = await fetch(`${API_URL}/pacientes`, {
      headers: { Authorization: `Bearer ${vetToken}` },
    });
    assert(pacientesRes.status === 200 && Array.isArray(await pacientesRes.json()), 'GET /api/pacientes accesible para Veterinario');

    // 5. Login Cliente
    const clientLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_CLIENT_EMAIL, password: process.env.TEST_CLIENT_PASSWORD }),
    });
    const clientLoginData = await clientLoginRes.json();
    assert(clientLoginRes.status === 200 && clientLoginData.token, 'Login Cliente exitoso');
    const clientToken = clientLoginData.token;

    const clientPetsRes = await fetch(`${API_URL}/mascotas`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const clientPets = await clientPetsRes.json();
    assert(clientPetsRes.status === 200 && Array.isArray(clientPets), 'GET /api/mascotas devuelve mascotas del cliente');

    const clientDashRes = await fetch(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const clientDash = await clientDashRes.json();
    assert(clientDashRes.status === 200 && typeof clientDash.mascotas === 'number', 'GET /api/dashboard devuelve datos del cliente');

    // 6. RBAC: Cliente intentando acceder a admin
    const rbacRes = await fetch(`${API_URL}/admin/resumen`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert(rbacRes.status === 403, 'RBAC: Cliente no puede acceder a /api/admin/resumen (403 Forbidden)');

    // 7. Credenciales incorrectas
    const badLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usuario_inexistente@petcare.local', password: 'password123' }),
    });
    const badLoginData = await badLoginRes.json();
    assert(
      badLoginRes.status === 401 && badLoginData.message === 'El email o la contraseña son incorrectos.',
      'Credenciales inválidas devuelven mensaje genérico sin revelar existencia de usuario',
    );

    console.log(`\n=== RESUMEN: ${passed} pasadas, ${failed} falladas ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error durante las pruebas:', err);
    process.exit(1);
  }
}

runTests();
