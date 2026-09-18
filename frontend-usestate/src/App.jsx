//controla el inicio de sesión, la navegación y 
// la información del usuario. Utiliza useState para manejar 
// las distintas pantallas (inicio, mascotas y perfil), 
// useEffect para comprobar si existe una sesión activa y 
// cargar las mascotas del usuario, y react-hook-form para 
// gestionar el formulario de login. También utiliza Axios 
// para comunicarse con el backend y enviar automáticamente 
// el token de autenticación. Además, permite cerrar sesión 
// eliminando el token y volver a la pantalla de login.
import { useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("petcare_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});// Configura una instancia de Axios con la URL base de la API y un interceptor
export default function App() {
  const [pantalla, setPantalla] = useState("login");
  const [usuario, setUsuario] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = localStorage.getItem("petcare_token");
    if (t)
      api
        .get("/auth/me")
        .then((r) => {
          setUsuario(r.data);
          setPantalla("inicio");
        })
        .catch(() => localStorage.removeItem("petcare_token"));
  }, []);
  useEffect(() => {
    if (usuario)
      api
        .get("/mascotas")
        .then((r) => setMascotas(r.data))
        .catch(() => setMascotas([]));
  }, [usuario]);
  const logout = () => {
    localStorage.removeItem("petcare_token");
    setUsuario(null);
    setPantalla("login");
  };
  if (pantalla === "login")
    return (
      <Login
        onLogin={async (d) => {
          try {
            const r = await api.post("/auth/login", d);
            localStorage.setItem("petcare_token", r.data.token);
            setUsuario(r.data.usuario);
            setPantalla("inicio");
          } catch {
            setError("Datos incorrectos");
          }
        }}
        error={error}
        go={setPantalla}
      />
    );
  return (
    <main>
      <header>
        <b>♥ PetCare · useState</b>
        <nav>
          {["inicio", "mascotas", "perfil"].map((x) => (
            <button onClick={() => setPantalla(x)} key={x}>
              {x}
            </button>
          ))}
          <button onClick={logout}>Salir</button>
        </nav>
      </header>
      {pantalla === "inicio" && (
        <section>
          <h1>Hola, {usuario.nombre}</h1>
          <p>
            Esta variante navega con <code>useState</code>, sin React Router.
          </p>
          <div className="card">
            Tenés {mascotas.length} mascotas registradas.
          </div>
        </section>
      )}
      {pantalla === "mascotas" && (
        <section>
          <h1>Mis mascotas</h1>
          {mascotas.map((m) => (
            <div className="card" key={m.id}>
              <b>{m.nombre}</b> · {m.especie}
            </div>
          ))}
        </section>
      )}
      {pantalla === "perfil" && (
        <section>
          <h1>Mi perfil</h1>
          <div className="card">
            {usuario.nombre} {usuario.apellido}
            <br />
            {usuario.email}
          </div>
        </section>
      )}
    </main>
  );
}
function Login({ onLogin, error }) {
  const { register, handleSubmit } = useForm();
  return (
    <main className="login">
      <form onSubmit={handleSubmit(onLogin)}>
        <b>♥ PetCare</b>
        <h1>Versión useState</h1>
        {error && <p className="error">{error}</p>}
        <input placeholder="Email" {...register("email", { required: true })} />
        <input
          type="password"
          placeholder="Contraseña"
          {...register("password", { required: true })}
        />
        <button>Ingresar</button>
      </form>
    </main>
  );
}
