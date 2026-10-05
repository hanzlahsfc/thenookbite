// Job titles a staff member can hold. Must stay in sync with the staff_role_check
// constraint — see db/staff_roles_expand.sql.

export const POS_ROLES = ['cashier', 'manager'] as const;

export const NON_POS_ROLES = [
  'chef', 'cook', 'kitchen_helper', 'waiter', 'rider',
  'cleaner', 'dishwasher', 'storekeeper', 'security',
] as const;

export const ALL_ROLES: string[] = [...POS_ROLES, ...NON_POS_ROLES];

export type StaffRole = typeof POS_ROLES[number] | typeof NON_POS_ROLES[number];
export type StaffType = 'pos' | 'non-pos';

export function rolesFor(type: StaffType): readonly string[] {
  return type === 'pos' ? POS_ROLES : NON_POS_ROLES;
}

/** "kitchen_helper" -> "Kitchen Helper" */
export function roleLabel(role: string): string {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
