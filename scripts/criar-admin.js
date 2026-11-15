import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31m%s\x1b[0m', 'ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no arquivo .env');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const email = process.argv[2] || 'rimublinda@gmail.com';
  const password = process.argv[3] || 'RimuAdmin#2026!';
  const nome = 'Lucas (Rimu)';

  console.log('\n\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[36m%s\x1b[0m', '  🛡️  RIMUBUSCA - CRIAÇÃO / ATIVAÇÃO DE USUÁRIO ADMINISTRADOR  ');
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
  console.log(`  E-mail:   \x1b[32m${email}\x1b[0m`);
  console.log(`  Perfil:   \x1b[33madmin\x1b[0m`);
;

  try {
    // 1. Verifica se o usuário já existe no auth.users do Supabase
    console.log('🔍 [1/3] Verificando existência do usuário no Supabase Auth...');
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Falha ao listar usuários do Supabase: ${listError.message}`);
    }

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId = null;

    if (existingUser) {
      console.log(`ℹ️  Usuário já cadastrado no Auth (ID: ${existingUser.id}). Atualizando senha e confirmação...`);
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: { nome, role: 'admin', ativo: true },
        }
      );

      if (updateError) {
        throw new Error(`Erro ao atualizar usuário: ${updateError.message}`);
      }

      userId = updateData.user.id;
      console.log('✅ Usuário no Supabase Auth atualizado com sucesso!');
    } else {
      console.log('➕ Usuário não encontrado. Criando nova conta de administrador...');
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, role: 'admin', ativo: true },
      });

      if (createError) {
        throw new Error(`Erro ao criar usuário: ${createError.message}`);
      }

      userId = createData.user.id;
      console.log(`✅ Usuário criado com sucesso no Supabase Auth! (ID: ${userId})`);
    }

    // 2. Atualiza ou insere o registro na tabela profiles
    console.log('\n🔄 [2/3] Vinculando perfil de Administrador na tabela public.profiles...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        nome,
        role: 'admin',
        ativo: true,
        ultimo_acesso: new Date().toISOString(),
      });

    if (profileError) {
      console.warn('\x1b[33m%s\x1b[0m', `⚠️  Aviso ao atualizar public.profiles: ${profileError.message}`);
      console.warn('\x1b[33m%s\x1b[0m', '👉 Caso a tabela public.profiles ainda não tenha sido criada, execute o arquivo supabase/schema.sql no SQL Editor do seu Supabase Dashboard.');
    } else {
      console.log('✅ Perfil gravado em public.profiles como role: "admin" e ativo: true!');
    }

    // 3. Resultado final
    console.log('\n\x1b[32m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  🎉 CONTA DE ADMINISTRADOR CONFIGURADA COM SUCESSO!         ');
    console.log('\x1b[32m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
    console.log(`  🌐 URL de Login:   \x1b[36mhttp://localhost:3000/login\x1b[0m`);
    console.log(`  📧 E-mail:         \x1b[1m${email}\x1b[0m`);
    console.log(`  🔑 Senha Provisória: \x1b[1m\x1b[33m${password}\x1b[0m`);
    console.log(`  🛡️  Papel (Role):   \x1b[1madmin (Acesso Completo)\x1b[0m`);
    console.log('\x1b[32m%s\x1b[0m', '═══════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n\x1b[31m%s\x1b[0m', `❌ ERRO FATAL: ${err.message}`);
    process.exit(1);
  }
}

main();
