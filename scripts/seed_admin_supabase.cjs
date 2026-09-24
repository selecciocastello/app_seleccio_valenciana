const fs = require('fs');
const path = require('path');

// Leer archivo .env manualmente
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nryblmocspengqztwhqf.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no está definido en .env');
  process.exit(1);
}

const headers = {
  'apikey': serviceRoleKey,
  'Authorization': `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('--- Sincronizando usuarios en Supabase Auth y Profiles ---');

  // 1. Listar usuarios actuales de Supabase Auth
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { headers });
  if (!listRes.ok) {
    console.error('Error listando usuarios de Supabase:', await listRes.text());
    return;
  }
  const { users: existingAuthUsers } = await listRes.json();
  console.log(`Usuarios existentes en Supabase Auth: ${existingAuthUsers.length}`);
  existingAuthUsers.forEach(u => {
    console.log(` - ${u.email} (ID: ${u.id}, confirmado: ${Boolean(u.email_confirmed_at)})`);
  });

  const usersToEnsure = [
    {
      email: 'seleccio.castello.2026@gmail.com',
      password: 'castello.2026',
      full_name: 'Administrador FFCV Castelló',
      role: 'admin',
      category: 'Totes'
    },
    {
      email: 'victor.canpro@gmail.com',
      password: 'castello.2026',
      full_name: 'Víctor Zandalinas',
      role: 'seleccionador',
      category: 'Sub-16'
    }
  ];

  // 2. Obtener roles de public.roles
  const rolesRes = await fetch(`${supabaseUrl}/rest/v1/roles?select=*`, { credentials: 'omit', headers });
  const roles = await rolesRes.json();
  const adminRole = Array.isArray(roles) ? roles.find(r => r.name === 'admin') : null;
  const selecRole = Array.isArray(roles) ? roles.find(r => r.name === 'seleccionador') : null;

  for (const user of usersToEnsure) {
    const existing = existingAuthUsers.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
    let userId;

    if (!existing) {
      console.log(`\nCreando usuario ${user.email} con email_confirm = true...`);
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            role_name: user.role,
            category_assigned: user.category
          }
        })
      });

      if (!createRes.ok) {
        console.error(`Error creando ${user.email}:`, await createRes.text());
        continue;
      }

      const createdUser = await createRes.json();
      userId = createdUser.id;
      console.log(`✓ Creado con éxito en Supabase Auth: ${user.email} (ID: ${userId})`);
    } else {
      userId = existing.id;
      console.log(`\nUsuario ${user.email} ya existe en Supabase Auth.`);
      
      // Auto-confirmar si estaba pendiente
      if (!existing.email_confirmed_at) {
        console.log(`Confirmando email de ${user.email}...`);
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ email_confirm: true })
        });
        console.log(`✓ Email confirmado.`);
      }
    }

    // Actualizar o crear registro en public.profiles
    const roleId = user.role === 'admin' ? adminRole?.id : selecRole?.id;
    const profilePayload = {
      id: userId,
      email: user.email,
      full_name: user.full_name,
      role_id: roleId,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(profilePayload)
    });

    if (profileRes.ok) {
      console.log(`✓ Perfil en public.profiles actualizado para ${user.email}`);
    } else {
      console.log(`(Nota sobre profiles: ${await profileRes.text()})`);
    }
  }

  // 3. Confirmar cualquier otro usuario pendiente en Supabase Auth
  for (const u of existingAuthUsers) {
    if (!u.email_confirmed_at) {
      console.log(`Confirmando usuario pendiente: ${u.email}...`);
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ email_confirm: true })
      });
      console.log(`✓ ${u.email} confirmado.`);
    }
  }

  console.log('\n--- ¡Todos los usuarios y el administrador están sincronizados y confirmados en Supabase! ---');
}

main().catch(console.error);
