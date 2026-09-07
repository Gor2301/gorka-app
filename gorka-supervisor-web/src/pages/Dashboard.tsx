// KPI Card - spec: 340px width, 116px height, 24px padding
const KPICard = ({ label, value, change }: any) => (
  <div className="bg-white border border-[#e4e4e7] rounded-[10px] p-6 min-w-[340px] h-[116px]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">{label}</div>
    <div className="text-[32px] font-bold text-[#18181b] mt-1">{value}</div>
    <div className="text-sm font-medium text-[#15803d] mt-1">↑ {change}</div>
  </div>
);

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Action Row - right aligned */}
      <div className="flex items-center justify-end gap-3">
        <button className="btn-secondary">📊 Export</button>
        <button className="btn-primary">➕ New</button>
      </div>

      {/* KPI Cards - spec: 24px gap */}
      <div className="grid grid-cols-4 gap-6">
        <KPICard label="Agents" value="12" change="2 this week" />
        <KPICard label="Active" value="8" change="1 this week" />
        <KPICard label="Success" value="68%" change="12% this week" />
        <KPICard label="Rating" value="4.5" change="0.3 this week" />
      </div>

      {/* Two Column Layout - spec: 24px gap */}
      <div className="grid grid-cols-2 gap-6">
        {/* Agent Activity */}
        <div className="card">
          <h2 className="text-[18px] font-semibold text-[#18181b] mb-4">Agent Activity</h2>
          <div className="space-y-2.5">
            {[
              { name: 'John Doe', status: 'online', calls: 23, resolved: 12 },
              { name: 'Sarah Lee', status: 'offline', calls: 18, resolved: 8 },
              { name: 'Mike Chen', status: 'online', calls: 31, resolved: 15 },
            ].map((agent, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                <div className="flex items-center gap-2.5">
                  <span className={`text-sm ${agent.status === 'online' ? 'text-[#22c55e]' : 'text-[#a1a1aa]'}`}>
                    {agent.status === 'online' ? '●' : '○'}
                  </span>
                  <span className="text-sm font-medium text-[#18181b]">{agent.name}</span>
                </div>
                <div className="flex gap-4 text-sm text-[#a1a1aa]">
                  <span>{agent.calls} calls</span>
                  <span className="text-[#15803d]">{agent.resolved} resolved</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-[18px] font-semibold text-[#18181b] mb-4">Recent Activity</h2>
          <div className="space-y-2.5">
            {[
              { text: 'John assigned 5 debtors', time: '2 hours ago' },
              { text: 'Sarah completed 12 calls', time: '4 hours ago' },
              { text: 'Mike pending approval', time: '6 hours ago', important: true },
            ].map((item, i) => (
              <div key={i} className={`px-3 py-2.5 rounded-lg border text-sm ${item.important ? 'border-[#7c3aed] bg-[#f0edfc]' : 'border-[#e4e4e7] bg-[#fafafa]'}`}>
                <div className="text-[#18181b]">{item.text}</div>
                <div className="text-xs text-[#a1a1aa] mt-0.5">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};