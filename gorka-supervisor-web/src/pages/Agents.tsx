export const Agents = () => {
  const agents = [
    { id: 1, name: 'John Doe', email: 'john@gorka.click', status: 'online', calls: 23, resolved: 12 },
    { id: 2, name: 'Sarah Lee', email: 'sarah@gorka.click', status: 'offline', calls: 18, resolved: 8 },
    { id: 3, name: 'Mike Chen', email: 'mike@gorka.click', status: 'online', calls: 31, resolved: 15 },
    { id: 4, name: 'Emma Wang', email: 'emma@gorka.click', status: 'online', calls: 27, resolved: 11 },
  ];

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex items-center justify-end gap-3">
        <button className="btn-primary">➕ Add Agent</button>
      </div>

      {/* Table - spec: white bg, #E4E4E7 border, 10px radius */}
      <div className="bg-white border border-[#e4e4e7] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <th className="text-left font-medium text-[#3f3f46] px-4 py-3">Agent</th>
              <th className="text-left font-medium text-[#3f3f46] px-4 py-3 hidden md:table-cell">Email</th>
              <th className="text-left font-medium text-[#3f3f46] px-4 py-3">Status</th>
              <th className="text-left font-medium text-[#3f3f46] px-4 py-3 hidden sm:table-cell">Calls</th>
              <th className="text-left font-medium text-[#3f3f46] px-4 py-3 hidden lg:table-cell">Resolved</th>
              <th className="text-right font-medium text-[#3f3f46] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-[#e4e4e7] hover:bg-[#fafafa] transition-colors">
                <td className="px-4 py-3 text-[#18181b]">{agent.name}</td>
                <td className="px-4 py-3 text-[#3f3f46] hidden md:table-cell">{agent.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${agent.status === 'online' ? 'text-[#22c55e]' : 'text-[#a1a1aa]'}`}>
                    {agent.status === 'online' ? '● Online' : '○ Offline'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#18181b] hidden sm:table-cell">{agent.calls}</td>
                <td className="px-4 py-3 text-[#18181b] hidden lg:table-cell">{agent.resolved}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-[#7c3aed] hover:text-[#6d28d9] text-sm font-medium transition-colors">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white border border-[#e4e4e7] rounded-[10px] p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-medium text-[#18181b]">{agent.name}</div>
                <div className="text-xs text-[#3f3f46]">{agent.email}</div>
              </div>
              <span className={`text-sm ${agent.status === 'online' ? 'text-[#22c55e]' : 'text-[#a1a1aa]'}`}>
                {agent.status === 'online' ? '●' : '○'}
              </span>
            </div>
            <div className="flex justify-between mt-2 text-sm text-[#3f3f46]">
              <span>Calls: {agent.calls}</span>
              <span>Resolved: {agent.resolved}</span>
            </div>
            <button className="w-full text-center text-[#7c3aed] text-sm py-2 mt-3 border border-[#e4e4e7] rounded-lg hover:bg-[#fafafa] transition-colors">
              Manage
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};