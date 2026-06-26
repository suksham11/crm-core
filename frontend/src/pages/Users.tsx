import { useState, useEffect } from "react";
import client from "../api/client";
import type { User } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    client.get("/users").then((res) => setUsers(res.data));
  }, []);

  if (user?.role !== "admin") {
    return <p className="text-gray-500">Access denied. Admin only.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 tracking-tight sm:text-3xl">
        Users
      </h1>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">
                Name
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">
                Email
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">
                Role
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
