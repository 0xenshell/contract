import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgentFirewall", (m) => {
  const ensResolver = m.getParameter("ensResolver");
  const creOracle = m.getParameter("creOracle");

  const firewall = m.contract("AgentFirewall", [ensResolver, creOracle]);

  return { firewall };
});
