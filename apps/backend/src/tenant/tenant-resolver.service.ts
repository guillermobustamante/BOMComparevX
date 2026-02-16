import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantResolverService {
  resolveTenantId(email: string): string {
    const fallback = process.env.DEFAULT_TENANT_ID || 'dev-tenant';
    const mappingRaw = process.env.TENANT_DOMAIN_MAP_JSON;

    if (!mappingRaw) {
      return fallback;
    }

    try {
      const mapping = JSON.parse(mappingRaw) as Record<string, string>;
      const domain = this.extractDomain(email);
      if (!domain) return fallback;
      return mapping[domain] || fallback;
    } catch {
      return fallback;
    }
  }

  private extractDomain(email: string): string | undefined {
    const at = email.lastIndexOf('@');
    if (at < 0 || at === email.length - 1) return undefined;
    return email.slice(at + 1).toLowerCase();
  }
}
