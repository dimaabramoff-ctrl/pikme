export class CreateSalonDto {
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  addressLine: string;
  city: string;
  country?: string;
  countryCode?: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  openingStatus?: string;
  isVerified?: boolean;
  homeVisitEnabled?: boolean;
}
