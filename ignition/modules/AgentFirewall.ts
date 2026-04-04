import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgentFirewall", (m) => {
  const ensResolver = m.getParameter("ensResolver");
  const nameWrapper = m.getParameter("nameWrapper");
  const ensParentNode = m.getParameter("ensParentNode");
  const forwarder = m.getParameter("forwarder");

  const firewall = m.contract("AgentFirewall", [ensResolver, nameWrapper, ensParentNode, forwarder]);

  return { firewall };
});
