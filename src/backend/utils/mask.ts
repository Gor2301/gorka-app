/**
 * PII Masking Utilities
 * Applied consistently across UI, CSV, and PDF exports
 */

export const maskEmail = (email: string | null | undefined): string => {
    if (!email) return '-';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    if (localPart.length <= 3) return `${localPart}...@${domain}`;
    return `${localPart.slice(0, 3)}...@${domain}`;
};

export const maskPhone = (phone: string | null | undefined): string => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return phone;
    const visible = cleaned.slice(-4);
    const masked = '*'.repeat(Math.min(cleaned.length - 4, 6));
    return `${masked}${visible}`;
};

export const maskName = (name: string | null | undefined): string => {
    if (!name) return '-';
    if (name.length <= 2) return name;
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return `${parts[0][0]}...`;
    }
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName[0]}... ${lastName[0]}...`;
};

// 🔥 FIX: Use a specific type instead of generic T
export const maskObject = (
    obj: Record<string, any>,
    fields: string[]
): Record<string, any> => {
    const result: Record<string, any> = { ...obj };
    fields.forEach((field) => {
        if (result[field] !== undefined && result[field] !== null) {
            if (field === 'email' || field === 'Email') {
                result[field] = maskEmail(result[field]);
            } else if (field === 'phone' || field === 'Phone' || field === 'phoneNumber') {
                result[field] = maskPhone(result[field]);
            } else if (field === 'name' || field === 'Name' || field === 'firstName' || field === 'lastName') {
                result[field] = maskName(result[field]);
            }
        }
    });
    return result;
};