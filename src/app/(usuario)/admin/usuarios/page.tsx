"use client";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import React, { useEffect, useState } from "react";
// import BasicTableOne from "@/components/tables/BasicTableOne";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import InputField from "@/components/form/input/InputField";
import { EnvelopeIcon} from "@/icons";
import Switch from "@/components/form/switch/Switch";


interface Empleado {
  id: number;
  nombre: string;
  fotoUrl: string;
  rol: string;
  estado: string;
  correo: string;
  celular: string;
  creado: string;
}

export default function usuariosSucursal() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  useEffect(() => {
      const fetchEmpleados = async () => {
        try {
          const res = await fetch("/api/usuarios", {
            credentials: "include",
          });
          const data = await res.json();
          setEmpleados(data);
        } catch (error) {
          console.error("Error al obtener empleados:", error);
        }
      };
      fetchEmpleados();
    }, []);


      const { isOpen, openModal, closeModal } = useModal();
      const handleSave = () => {
        // Handle save logic here
        console.log("Saving changes...");
        closeModal();
      };

      const handleSwitchChange = (checked: boolean) => {
        console.log("Switch is now:", checked ? "ON" : "OFF");
      };
    
  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] space-y-10 sm:space-y-6">
        <h1 className="text-center mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          USUARIOS DE LA SUCURSAL
        </h1>
        <div>
          {empleados.map((empleado) => ( 
            <UserMetaCard
                key={empleado.id}
                userData={empleado}
             />
          ))}
          
        </div>
          <Button size="sm" variant="outline" className="w-full" onClick={openModal}>
            Agregar Usuario
          </Button>
        {/* <BasicTableOne  /> */}
      </div>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="space-y-4">
                  <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Editar Información Personal
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Actualice sus datos para mantener su perfil actualizado.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">

              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información Personal
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Nombre Completo</Label>
                    <Input className=" text-gray-500  dark:border-gray-800 dark:text-gray-400" type="text" placeholder="Juan Pérez" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Nombre de Usuario</Label>
                    <Input className=" text-gray-500  dark:border-gray-800 dark:text-gray-400" type="text" placeholder="juanperez" />
                  </div>

                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Correo Electronico</Label>
                    <div className="relative">
                      <Input
                        placeholder="info@gmail.com"
                        type="text"
                        className="pl-[62px] text-gray-500  dark:border-gray-800 dark:text-gray-400"
                      />
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3.5 py-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <EnvelopeIcon />
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Celular</Label>
                    <Input className=" text-gray-500  dark:border-gray-800 dark:text-gray-400" type="text" placeholder="6XXXXXX" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Contraseña</Label>
                    <InputField className=" text-gray-500  dark:border-gray-800 dark:text-gray-400" type="password" placeholder="********" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Confirmar Contraseña</Label>
                    <InputField className=" text-gray-500  dark:border-gray-800 dark:text-gray-400" type="password" placeholder="********" />
                  </div>

                  <div>
                    <Switch
                      label="Privilegios de Administrador"
                      defaultChecked={false}
                      onChange={handleSwitchChange}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Cerrar
              </Button>
              <Button size="sm" onClick={handleSave}>
                Registrar Usuario
              </Button>
            </div>
          </form>
        </div>

        </div>
      </Modal>
    </>
    );
}
