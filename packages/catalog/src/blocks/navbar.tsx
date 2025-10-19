import React from "react";
import { Link, useLocation } from "react-router";

export const Navbar: React.FC = () => {
  const location = useLocation();

  const links = [
    // { title: "Home", to: "/" },
    { title: "Events", to: "/events" },
    { title: "Attributes", to: "/attributes" },
    { title: "Destinations", to: "/destinations" },
    { title: "Effects", to: "/effects" },
  ];

  return (
    <div className="bg-zinc-900 p-4.5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start pl-4">
            <a href="/">
              <img src="/img/logo.png" className="w-8 inline-block" alt="" />
              <img src="/img/logo-text.png" className="h-4 pl-3 inline-block opacity-95" alt="" />
            </a>
          </div>

          <ul className="flex gap-0 text-white text-sm justify-end pr-4">
            {links.map((link) => (
              <li key={link.title}>
                <Link
                  to={link.to}
                  className={`${
                    location.pathname.startsWith(link.to)
                      ? "text-white bg-zinc-800 px-3 py-3 rounded-md"
                      : "text-zinc-400 px-3 py-2 rounded-md hover:text-white"
                  }`}
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
