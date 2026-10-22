-- Protege a aprovação contra turnos gerados automaticamente e não conferidos.
CREATE OR REPLACE FUNCTION public.require_reviewed_shifts_before_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE number_of_units integer; number_of_reviewed integer;
BEGIN
 SELECT (SELECT count(*) FROM public.daily_team_assignments WHERE work_date=NEW.work_date)
      + (SELECT count(*) FROM public.service_posts) INTO number_of_units;
 SELECT count(*) INTO number_of_reviewed FROM public.daily_shift_plans
  WHERE work_date=NEW.work_date
    AND review_status='revisado' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
    AND length(btrim(planned_activity))>=3 AND length(btrim(coalesce(planned_location,'')))>=3;
 IF number_of_reviewed <> number_of_units*2 THEN
  RAISE EXCEPTION 'Aprovação impedida: revisar individualmente manhã e tarde de todas as equipes e postos (% de %)',number_of_reviewed,number_of_units*2;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER require_reviewed_shifts BEFORE INSERT ON public.daily_plan_approvals
FOR EACH ROW EXECUTE FUNCTION public.require_reviewed_shifts_before_approval();