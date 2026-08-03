export class CreateServiceDto {
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  durationMinutes: number;
  availableInSalon?: boolean;
  availableAtHome?: boolean;
}
