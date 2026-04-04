import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgentFirewall", (m) => {
  const ensResolver = m.getParameter("ensResolver");
  const forwarder = m.getParameter("forwarder");

  const firewall = m.contract("AgentFirewall", [ensResolver, forwarder]);

  return { firewall };
});
