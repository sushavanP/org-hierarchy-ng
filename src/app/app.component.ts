import { Component } from '@angular/core';
import { AppValidatorService } from './app-validator.service';
import { ValidationError, OrgUser } from 'src/models/commonTypes';
import * as Papa from 'papaparse';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  errors: ValidationError[] = [];
  success = false;
  csvFormatIssue: boolean = false;
  constructor(private appValidatorService: AppValidatorService) {}

  get hasAdminLevelErrors() {
    return this.errors.some(
      (e) =>
        e.userData.role === 'Admin' ||
        (e.userData.reportsTo &&
          e.userData.reportsTo.toLowerCase().includes('root'))
    );
  }

  get hasManagerLevelErrors() {
    return this.errors.some((e) => e.userData.role === 'Manager');
  }

  get hasCallerLevelErrors() {
    return this.errors.some((e) => e.userData.role === 'Caller');
  }

  get hasTooManyErrors() {
    return this.errors.some(
      (e) => e.userData.reportsTo && e.userData.reportsTo.includes(';')
    );
  }

  findErrorsByRole(role: string): ValidationError[] {
    return this.errors.filter(
      (e) =>
        e.userData.role === role &&
        (!e.userData.reportsTo || !e.userData.reportsTo.includes(';'))
    );
  }

  findUsersWithMultipleErrors(): ValidationError[] {
    return this.errors.filter(
      (e) => e.userData.reportsTo && e.userData.reportsTo.includes(';')
    );
  }

  onFileInput(event: Event) {
    this.csvFormatIssue = false
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.errors = [];
    this.success = false;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('Data after parsing ---', results.data);

        const users = results.data
          .filter((row: any) => row.Email && row.Role)
          .map((row: any) => ({
            email: row.Email.trim(),
            fullName: row.FullName.trim(),
            role: row.Role.trim(),
            reportsTo: row.ReportsTo ? row.ReportsTo.trim() : '',
          })) as OrgUser[];

        console.log('User array after removing invalid rows', users);
        if(users && users.length == 0) {
          this.csvFormatIssue = true;
          return;
        }
        this.errors = this.appValidatorService.validateOrganizationHierarchy(users);
        console.log('Errors array', this.errors); 
        this.success = this.errors.length === 0;
      },
      error: (error) => {
        console.error('Error occured while parsing input file:', error);
        alert("Error occured while parsing the file. Check if it's a valid CSV file.");
      },
    });
  }
}
