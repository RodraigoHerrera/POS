"use client"; // Indica que este componente se ejecutará en el cliente (importante en aplicaciones Next.js con renderizado híbrido)

import Input from "@/components/form/input/InputField"; // Componente de campo de entrada personalizado
import Label from "@/components/form/Label"; // Componente para etiquetas de formulario
import Button from "@/components/ui/button/Button"; // Componente de botón personalizado
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons"; // Importación de iconos usados en la UI
import Link from "next/link"; // Componente de navegación de Next.js para enlaces internos
import React, { useState } from "react"; // Importación de React y hook useState para manejo de estados
import { useRouter } from "next/navigation"; // Hook de Next.js para manejar la navegación programática

// Componente funcional que representa el formulario de registro de sucursal
export default function SignUpForm() {
  // Declaración de estados para gestionar la visibilidad de la contraseña y los valores de cada campo del formulario
  const [showPassword, setShowPassword] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter(); // Obtenemos el objeto router para redireccionar después de la operación

  // Estado para almacenar errores específicos de cada campo
  const [erroresCampo, setErroresCampo] = useState<{ [key: string]: string }>({});

  // Función auxiliar para capitalizar la primera letra de un texto y convertir el resto a minúsculas
  const capitalizar = (texto: string) => {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
  };

  // Función manejadora del evento submit del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario (recarga de página)
    setError(""); // Reinicia cualquier error previo
    setIsLoading(true); // Indica que se ha iniciado el proceso de registro

    // Objeto para acumular los errores de validación de cada campo
    const nuevosErrores: { [key: string]: string } = {};

    // Validaciones de cada campo del formulario
    if (!nombre) nuevosErrores.nombre = "El nombre es obligatorio";
    if (!direccion) nuevosErrores.direccion = "La dirección es obligatoria";

    if (!correo) {
      nuevosErrores.correo = "El correo es obligatorio";
    } else if (!correo.endsWith("@gmail.com")) {
      nuevosErrores.correo = "El correo debe terminar en @gmail.com";
    }

    if (!telefono) {
      nuevosErrores.telefono = "El teléfono es obligatorio";
    } else if (!/^\d+$/.test(telefono)) {
      nuevosErrores.telefono = "El teléfono debe contener solo números";
    }

    if (!contraseña) {
      nuevosErrores.contraseña = "La contraseña es obligatoria";
    } else if (contraseña.length < 8) {
      nuevosErrores.contraseña = "La contraseña debe tener al menos 8 caracteres";
    }

    // Si existen errores de validación, se actualiza el estado y se detiene el proceso de envío
    if (Object.keys(nuevosErrores).length > 0) {
      setErroresCampo(nuevosErrores);
      setIsLoading(false);
      return;
    }

    // Si no hay errores, se limpia el objeto de errores
    setErroresCampo({});

    // Normalizamos el nombre y la dirección utilizando la función capitalizar
    const nombreFormateado = capitalizar(nombre);
    const direccionFormateada = capitalizar(direccion);

    // Realizamos una petición POST a la API para registrar la nueva sucursal
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nombre: nombreFormateado,
        direccion: direccionFormateada,
        correo,
        telefono,
        contraseña,
      }),
    });

    // Se procesa la respuesta de la API
    const data = await res.json();

    if (res.ok) {
      // Si la respuesta es exitosa, se redirige a la página principal
      router.push(`/signup/newadmin?sucursalId=${data.sucursal.id}`);
    } else {
      // En caso de error, se muestra el mensaje recibido o un mensaje por defecto
      setError(data.message || "Ocurrió un error al registrar la sucursal");
      setIsLoading(false);
    }
  };

  // Renderizado del componente: se muestra el formulario con sus respectivos campos y validaciones
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar bg-[#0C0C0F]/95 p-6 rounded shadow max-w-lg">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Encabezado del formulario */}
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-25 text-title-sm sm:text-title-md text-center">
              Registrar Sucursal
            </h1>
            <p className="text-sm text-gray-200 text-center">
              ¡Enhorabuena! Una nueva sucursal se une a nuestra historia de éxito.
            </p>
          </div>
          <div>
            {/* Formulario con manejo del evento onSubmit */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                {/* Primera fila: campos Nombre y Dirección */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      Nombre<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Nombre de la sucursal"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                    {erroresCampo.nombre && (
                      <p className="text-sm text-error-500">{erroresCampo.nombre}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Dirección<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Dirección de la sucursal"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                    />
                    {erroresCampo.direccion && (
                      <p className="text-sm text-error-500">{erroresCampo.direccion}</p>
                    )}
                  </div>
                </div>

                {/* Segunda fila: campos Correo y Teléfono */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      Correo<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="Correo de la sucursal"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                    />
                    {erroresCampo.correo && (
                      <p className="text-sm text-error-500">{erroresCampo.correo}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Teléfono<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Teléfono de la sucursal"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                    {erroresCampo.telefono && (
                      <p className="text-sm text-error-500">{erroresCampo.telefono}</p>
                    )}
                  </div>
                </div>

                {/* Campo para la contraseña, con opción para mostrar/ocultar el valor */}
                <div>
                  <Label>
                    Contraseña<span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Ingresa tu contraseña"
                      type={showPassword ? "text" : "password"}
                      value={contraseña}
                      onChange={(e) => setContraseña(e.target.value)}
                    />
                    {/* Ícono para alternar la visibilidad de la contraseña */}
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-200 " />
                      ) : (
                        <EyeCloseIcon className="fill-gray-200 " />
                      )}
                    </span>
                  </div>
                  {erroresCampo.contraseña && (
                    <p className="text-sm text-error-500">{erroresCampo.contraseña}</p>
                  )}
                </div>

                {/* Botón de envío del formulario */}
                <div>
                  <Button className="w-full" size="sm" disabled={isLoading}>
                    {isLoading ? "Registrando..." : "Registrarse"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
