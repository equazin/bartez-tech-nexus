-- 121: la sincronización de ELIT leía el nombre de cada atributo de `nombre`, pero ELIT lo manda
-- en `atributo`. Por eso los atributos quedaron guardados como atributo_1, atributo_2... y en la
-- ficha de la tienda se veían como "Atributo 1: 24 pulgadas". El código ya lee `atributo`; esta
-- migración borra las claves sin nombre. La próxima sincronización las vuelve a cargar con su nombre.

UPDATE products p
SET specs = (
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(p.specs) AS e
  WHERE e.key !~ '^atributo_[0-9]+$'
)
WHERE jsonb_typeof(p.specs) = 'object'
  AND EXISTS (SELECT 1 FROM jsonb_object_keys(p.specs) AS k WHERE k ~ '^atributo_[0-9]+$');
