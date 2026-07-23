-- Migration incremental: corrige a leitura do próprio perfil antes de estar vinculado a uma organização.
-- Problema: a política original só permitia ler o perfil quando organization_id já era igual à
-- organização do usuário — mas um perfil recém-criado tem organization_id nulo, então o próprio
-- usuário não conseguia ler seu perfil para descobrir a organização (efeito "galinha e ovo").
-- Solução: permitir sempre a leitura do próprio perfil (id = auth.uid()), além da leitura de
-- perfis da mesma organização.

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid() or organization_id = current_org_id()
);
