---
name: zod-data-validation
description: "Implementa esquemas de validación estrictos usando Zod para asegurar la integridad de los datos en toda la aplicación."
metadata:
  {
    "features": [
      "01 Validación estricta de tipos en tiempo de ejecución",
      "02 Inferencia automática de tipos TypeScript",
      "03 Mensajes de error personalizados para el usuario",
      "04 Limpieza y transformación de datos automática",
      "05 Blindaje contra inyecciones de datos corruptos",
      "06 124,859 estrellas de reconocimiento"
    ],
    "use_cases": [
      "01 Validar el formato de RUC y correos de clientes",
      "02 Asegurar que los cálculos de impuestos reciban números válidos",
      "03 Sanitizar las importaciones masivas de datos desde Sheets/Excel"
    ]
  }
---

# Validación y Blindaje de Datos (SKILL10)

Esta habilidad es la "armadura" de tu base de datos. Asegura que ningún dato entre al sistema sin ser verificado primero por un esquema estricto.

## ¿Qué ganamos con Zod?

1. **Cero Datos Corruptos**: Si alguien intenta guardar un cliente sin RUC o con un formato de correo inválido, el sistema lo detendrá antes de que llegue a `IndexedDB`.
2. **Autocorrección**: Podemos configurar Zod para que si un usuario escribe un RUC con espacios o guiones, el sistema los limpie automáticamente antes de guardarlos.
3. **Seguridad en la API**: Si en el futuro conectamos con servicios externos, Zod servirá como el primer filtro de seguridad.

---

*Un sistema es tan fuerte como la integridad de sus datos.*
