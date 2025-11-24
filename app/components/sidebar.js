"use client";
import { useRouter } from "next/navigation";
import { useStrings } from "@/app/hooks/useStrings";

export default function Sidebar() {
    const router = useRouter();
    const { t } = useStrings();

    const usersBtn = (e) => {
        e.preventDefault();
        console.log("Library button clicked");
        router.push("/pages/usersScreen");
    };
    const orgBtn = (e) => {
        e.preventDefault();
        console.log("Organizations button clicked");
        router.push("/pages/orgScreen");
    };
    const mapBtn = (e) => {
        e.preventDefault();
        console.log("Map button clicked");
        router.push("/pages/mapScreen");
    };
    const devBtn = (e) => {
        e.preventDefault();
        console.log("Developers button clicked");
        router.push("/pages/devScreen");
    };
    const subscriptionsBtn = (e) => {
        e.preventDefault();
        console.log("Subscriptions button clicked");
        router.push("/pages/subscriptions");
    };
    const ticketsBtn = (e) => {
        e.preventDefault();
        console.log("Tickets button clicked");
        router.push("/pages/tickets");
    }


  return (
    <div className="sticky top-2 w-56 h-screen bg-green-800 text-white flex flex-col justify-between rounded-lg shadow-lg m-2 shrink-0 z-10">
      <div>
        <div className="p-4 text-2xl font-semibold">Geo-Note</div>

        <div className="flex flex-col space-y-4 mt-4 px-4">
          <button onClick={usersBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
            {t('nav.users')}
          </button>
          <button onClick={orgBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
            Организации
          </button>
          <button onClick={mapBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
            Карта
          </button>
          <button onClick={devBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
            Разработчики
          </button>
          <button onClick={subscriptionsBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
            Подписки
          </button>
          <button onClick={ticketsBtn} className="bg-green-400 text-black py-2 rounded-md hover:bg-green-300 transition">
          {t('nav.tickets')}
          </button>

          
        </div>
      </div>

      <div className="p-4 text-xs text-gray-200">
        <p>Made by abdu1axad</p>
        <p>Copyright 2025</p>
      </div>
    </div>
  );
}
