import http from '../http.js'

export function getFirewallStatusApi(params) {
  return http.post('/puppet-node/firewall/status', params)
}

export function listFirewallRulesApi(params) {
  return http.post('/puppet-node/firewall/list-rules', params)
}

export function addFirewallRuleApi(params) {
  return http.post('/puppet-node/firewall/add-rule', params)
}

export function deleteFirewallRuleApi(params) {
  return http.post('/puppet-node/firewall/delete-rule', params)
}

export function toggleFirewallApi(params) {
  return http.post('/puppet-node/firewall/toggle', params)
}
