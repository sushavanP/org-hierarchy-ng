import { Injectable } from '@angular/core';
import { OrgUser, ValidationError } from '../models/commonTypes';

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

    console.log("user map", userMap)

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

        if(userWithCapitalizedRole.role == 'Root') {
          if (userWithCapitalizedRole.reportsTo) {
            errors.push({
              row: index + 2,
              message: 'Root should not report to anyone',
              userData: userWithCapitalizedRole,
            });
          }
        } else if(userWithCapitalizedRole.role == 'Admin') {
          if (!manager || manager.role !== 'Root') {
            errors.push({
              row: index + 2,
              message: `${
                userWithCapitalizedRole.fullName
              } is an Admin but reports to ${
                manager
                  ? `${manager.fullName} (${manager.role})`
                  : 'an unknown user'
              }, not Root`,
              userData: userWithCapitalizedRole,
            });
          }
        } else if(userWithCapitalizedRole.role == 'Manager') {
          if (!manager || !['Manager', 'Admin'].includes(manager.role)) {
            errors.push({
              row: index + 2,
              message: `${
                userWithCapitalizedRole.fullName
              } is a Manager but reports to ${
                manager
                  ? `${manager.fullName} (a ${manager.role})`
                  : 'an unknown user'
              }`,
              userData: userWithCapitalizedRole,
            });
          }
        } else if(userWithCapitalizedRole.role == 'Caller') {
          if (!manager || manager.role !== 'Manager') {
            errors.push({
              row: index + 2,
              message: `${
                userWithCapitalizedRole.fullName
              } is a Caller but reports to ${
                manager
                  ? `${manager.fullName} (${manager.role})`
                  : 'an unknown user'
              }`,
              userData: userWithCapitalizedRole,
            });
          }
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
}
