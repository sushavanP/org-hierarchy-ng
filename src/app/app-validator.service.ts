import { Injectable } from '@angular/core';
import { OrgUser, ValidationError, UserRole } from '../models/commonTypes';

@Injectable({
  providedIn: 'root',
})
export class AppValidatorService {
  validateOrganizationHierarchy(users: OrgUser[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const userMap = new Map<string, OrgUser>();

    // Build user map for quick lookup
    users.forEach((user) => {
      userMap.set(user.email.toLowerCase(), {
        ...user,
        role: this.capitalizedRole(user.role),
      });
    });

    users.forEach((user, index) => {
      const userWithCapitalizedRole = {
        ...user,
        role: this.capitalizedRole(user.role),
      };

      if (userWithCapitalizedRole.reportsTo && userWithCapitalizedRole.reportsTo.includes(';')) {
        errors.push({
          row: index + 2,
          message: `${userWithCapitalizedRole.fullName} is reporting to multiple users: ${userWithCapitalizedRole.reportsTo}`,
          userData: userWithCapitalizedRole,
        });
        return;
      }

      if (!userWithCapitalizedRole.reportsTo && userWithCapitalizedRole.role !== 'Root') {
        errors.push({
          row: index + 2,
          message: `${userWithCapitalizedRole.fullName} must report to someone`,
          userData: userWithCapitalizedRole,
        });
        return;
      }

      if (userWithCapitalizedRole.reportsTo) {
        const manager = userMap.get(userWithCapitalizedRole.reportsTo.toLowerCase());

        const { path, cycleDetails } = this.getReportsToPathCycle(userWithCapitalizedRole.email.toLowerCase(), userMap);
        
        if (cycleDetails) {
          const cycleUsers = cycleDetails.map(email => {
            const user = userMap.get(email.toLowerCase());
            return `${user?.fullName} (${user?.role})`;
          }).join(' → ');

          errors.push({
            row: index + 2,
            message: `Circular reporting chain detected: ${cycleUsers}. This creates an invalid hierarchy where subordinates and managers form a loop.`,
            userData: userWithCapitalizedRole
          });
          return;
        }

        for (let i = 0; i < path.length - 1; i++) {
          const currentUser = userMap.get(path[i].toLowerCase());
          const currentManager = userMap.get(path[i + 1].toLowerCase());
          
          if (currentUser && currentManager) {
            if (!this.isReportingToValidRole(currentUser.role, currentManager.role)) {
              const chain = path.slice(0, i + 2).map(email => {
                const user = userMap.get(email.toLowerCase());
                return `${user?.fullName} (${user?.role})`;
              }).join(' → ');

              errors.push({
                row: index + 2,
                message: `Invalid reporting chain: ${chain}. ${this.getOrgHierarchyRule(currentUser.role)}`,
                userData: userWithCapitalizedRole
              });
              return;
            }
          }
        }

        if (manager) {
          if (!this.isReportingToValidRole(userWithCapitalizedRole.role, manager.role)) {
            errors.push({
              row: index + 2,
              message: `Invalid direct report: ${userWithCapitalizedRole.fullName} (${userWithCapitalizedRole.role}) cannot report to ${manager.fullName} (${manager.role}). ${this.getOrgHierarchyRule(userWithCapitalizedRole.role)}. ${this.getOrgHierarchyRule(userWithCapitalizedRole.role)}`,
              userData: userWithCapitalizedRole,
            });
          }
        } else {
          errors.push({
            row: index + 2,
            message: `${userWithCapitalizedRole.fullName} reports to an unknown user: ${userWithCapitalizedRole.reportsTo}`,
            userData: userWithCapitalizedRole
          });
        }
      }
    });

    return errors;
  }

  private capitalizedRole(role: string): 'Caller' | 'Manager' | 'Admin' | 'Root' {
    const capitalized =
      role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    return capitalized as 'Caller' | 'Manager' | 'Admin' | 'Root';
  }

    private getReportsToPathCycle(userEmail: string, userMap: Map<string, OrgUser>): { 
    path: string[], 
    cycleDetails: string[] | null 
  } {
    const visited = new Set<string>();
    const path: string[] = [];
    
    let currentEmail = userEmail;
    while (currentEmail) {
      if (visited.has(currentEmail)) {
        const cycleStartIndex = path.indexOf(currentEmail);
        const cycle = path.slice(cycleStartIndex).concat(currentEmail);
        return { path, cycleDetails: cycle };
      }
      
      path.push(currentEmail);
      visited.add(currentEmail);
      
      const user = userMap.get(currentEmail);
      if (!user || !user.reportsTo) break;
      
      currentEmail = user.reportsTo.toLowerCase();
    }
    
    return { path, cycleDetails: null };
  }

  private getOrgHierarchyRule(role: UserRole): string {
    const rules = {
      'Root': 'Root should not report to anyone.',
      'Admin': 'Admins can only report to Root.',
      'Manager': 'Managers can only report to Admins or other Managers.',
      'Caller': 'Callers can only report to Managers.'
    };
    return rules[role] || '';
  }

  private isReportingToValidRole(subordinateRole: string, managerRole: string): boolean {
    const roleHierarchy: Record<UserRole, UserRole[]> = {
      'Root': [],
      'Admin': ['Root'],
      'Manager': ['Admin', 'Manager'],
      'Caller': ['Manager']
    };

    return roleHierarchy[subordinateRole as UserRole]?.includes(managerRole as UserRole) || false;
  }
}